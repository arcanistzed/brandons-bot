import {
	Client,
	Events,
	GatewayIntentBits,
	Message,
	SlashCommandBuilder,
	User,
} from "discord.js";
import dotenv from "dotenv";
import { REST, Routes } from "discord.js";

dotenv.config();
if (!process.env.TOKEN) throw new Error("No token provided");

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
});

const synced: SyncedMessage[] = [];

client.on(Events.ClientReady, async () => {
	console.info(`Logged in as ${client.user?.tag}!`);
});

// Create slash command
let command = new SlashCommandBuilder()
	.setName("sync")
	.setDescription("Sync a message to a user's DMs")
	.addStringOption(option =>
		option
			.setName("message")
			.setDescription("The message ID to sync")
			.setRequired(true),
	);

for (let i = 0; i < 20; i++) {
	command = command.addUserOption(option =>
		option
			.setName(`user${i}`)
			.setDescription(`User #${i + 1} to sync the message to`)
			.setRequired(i === 0),
	);
}

// Handle slash command
client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isCommand()) return;

	if (interaction.commandName === command.name) {
		const users = new Array(20)
			.fill(null)
			.map((_, i) => {
				const option = interaction.options.get(`user${i}`, false);
				if (!option) return null;

				const user = option.user;
				if (!user) return null;

				return user;
			})
			.filter((u): u is User => !!u);

		const messageId = interaction.options.get("message", true)
			.value as string;

		console.info(`Syncing message ${messageId} to users ${users}`);

		const source = await interaction.channel?.messages.fetch(messageId);
		if (!source) {
			await interaction.reply("Couldn't find that message!");
			return;
		}

		for (const user of users) {
			const dmChannel = await user.createDM();
			const sent = await dmChannel.send(source.content);

			synced.push({
				source,
				sent,
			});
		}

		await interaction.reply(
			`Sent message to ${users.length} users: \`\`\`${source.content}\`\`\``,
		);
	}
});

// Deploy slash command
const rest = new REST({ version: "9" }).setToken(process.env.TOKEN);
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!clientId) throw new Error("No client ID provided");
if (!guildId) throw new Error("No guild ID provided");

(async () => {
	try {
		console.info("Started refreshing application (/) commands.");

		await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
			body: [command.toJSON()],
		});

		console.info("Successfully reloaded application (/) commands.");
	} catch (error) {
		console.error(error);
	}
})();

// Message updates
client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
	console.info("Message updated");
	if (oldMessage.partial || newMessage.partial) return;
	if (oldMessage.content === newMessage.content) return;

	if (!synced) return;

	const syncedMessages = synced.filter(m => m.source.id === oldMessage.id);
	if (!syncedMessages) return;

	for (const syncedMessageSource of syncedMessages) {
		await syncedMessageSource.sent.edit(newMessage.content);
	}

	if (syncedMessages.length === 0) return;
	await newMessage.reply(
		`Updated synced message to ${syncedMessages.length} users: \`\`\`${newMessage.content}\`\`\``,
	);
});

void client.login(process.env.TOKEN);

type SyncedMessage = {
	source: Message;
	sent: Message;
};
