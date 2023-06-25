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
const command = new SlashCommandBuilder()
	.setName("sync")
	.setDescription("Sync a message to a user's DMs")
	.addStringOption(option =>
		option
			.setName("message")
			.setDescription("The message ID to sync")
			.setRequired(true),
	)
	// Multiple users
	.addUserOption(option =>
		option
			.setName("user")
			.setDescription("The users to sync the message to")
			.setRequired(true),
	)
	.addUserOption(option =>
		option
			.setName("user1")
			.setDescription("Additional users to sync the message to")
			.setRequired(false),
	)
	.addUserOption(option =>
		option
			.setName("user2")
			.setDescription("Additional users to sync the message to")
			.setRequired(false),
	)
	.addUserOption(option =>
		option
			.setName("user3")
			.setDescription("Additional users to sync the message to")
			.setRequired(false),
	)
	.addUserOption(option =>
		option
			.setName("user4")
			.setDescription("Additional users to sync the message to")
			.setRequired(false),
	)
	.addUserOption(option =>
		option
			.setName("user5")
			.setDescription("Additional users to sync the message to")
			.setRequired(false),
	)
	.addUserOption(option =>
		option
			.setName("user6")
			.setDescription("Additional users to sync the message to")
			.setRequired(false),
	)
	.addUserOption(option =>
		option
			.setName("user7")
			.setDescription("Additional users to sync the message to")
			.setRequired(false),
	)
	.addUserOption(option =>
		option
			.setName("user8")
			.setDescription("Additional users to sync the message to")
			.setRequired(false),
	)
	.addUserOption(option =>
		option
			.setName("user9")
			.setDescription("Additional users to sync the message to")
			.setRequired(false),
	)
	.addUserOption(option =>
		option
			.setName("user10")
			.setDescription("Additional users to sync the message to")
			.setRequired(false),
	)
	.addUserOption(option =>
		option
			.setName("user11")
			.setDescription("Additional users to sync the message to")
			.setRequired(false),
	)
	.addUserOption(option =>
		option
			.setName("user12")
			.setDescription("Additional users to sync the message to")
			.setRequired(false),
	)
	.addUserOption(option =>
		option
			.setName("user13")
			.setDescription("Additional users to sync the message to")
			.setRequired(false),
	)
	.addUserOption(option =>
		option
			.setName("user14")
			.setDescription("Additional users to sync the message to")
			.setRequired(false),
	)
	.addUserOption(option =>
		option
			.setName("user15")
			.setDescription("Additional users to sync the message to")
			.setRequired(false),
	)
	.addUserOption(option =>
		option
			.setName("user16")
			.setDescription("Additional users to sync the message to")
			.setRequired(false),
	)
	.addUserOption(option =>
		option
			.setName("user17")
			.setDescription("Additional users to sync the message to")
			.setRequired(false),
	)
	.addUserOption(option =>
		option
			.setName("user18")
			.setDescription("Additional users to sync the message to")
			.setRequired(false),
	)
	.addUserOption(option =>
		option
			.setName("user19")
			.setDescription("Additional users to sync the message to")
			.setRequired(false),
	);

// Handle slash command
client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isCommand()) return;

	if (interaction.commandName === command.name) {
		const users = [
			interaction.options.getUser("user", true),
			interaction.options.getUser("user1", false),
			interaction.options.getUser("user2", false),
			interaction.options.getUser("user3", false),
			interaction.options.getUser("user4", false),
			interaction.options.getUser("user5", false),
			interaction.options.getUser("user6", false),
			interaction.options.getUser("user7", false),
			interaction.options.getUser("user8", false),
			interaction.options.getUser("user9", false),
			interaction.options.getUser("user10", false),
			interaction.options.getUser("user11", false),
			interaction.options.getUser("user12", false),
			interaction.options.getUser("user13", false),
			interaction.options.getUser("user14", false),
			interaction.options.getUser("user15", false),
			interaction.options.getUser("user16", false),
			interaction.options.getUser("user17", false),
			interaction.options.getUser("user18", false),
			interaction.options.getUser("user19", false),
		].filter((user): user is User => !!user);
		const messageId = interaction.options.get("message", true)
			.value as string;
		console.info(`Syncing message ${messageId} to users ${users}`);

		const source = await interaction.channel?.messages.fetch(messageId);
		if (!source) {
			await interaction.reply("Couldn't find that message!");
			return;
		}

		for (const user of users.values()) {
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

	await newMessage.reply(
		`Updated synced message to ${syncedMessages.length} users: \`\`\`${newMessage.content}\`\`\``,
	);
});

void client.login(process.env.TOKEN);

type SyncedMessage = {
	source: Message;
	sent: Message;
};
