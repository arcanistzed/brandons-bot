import {
	ChannelType,
	Client,
	Events,
	GatewayIntentBits,
	Message,
	Partials,
	REST,
	Routes,
	SlashCommandBuilder,
	User,
} from "discord.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();
if (!process.env.TOKEN) throw new Error("No token provided");

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.DirectMessages,
	],
	partials: [Partials.Channel],
});

const synced: SyncedMessage[] = [];
let forwardChannel: string | undefined = undefined;

client.on(Events.ClientReady, async () => {
	console.info(`Logged in as ${client.user?.tag}!`);
});

// Create slash commands
const commands = [
	new SlashCommandBuilder()
		.setName("sync")
		.setDescription("Sync a message to a user's DMs")
		.addStringOption(option =>
			option
				.setName("message")
				.setDescription("The message ID to sync")
				.setRequired(true),
		)
		.addStringOption(option =>
			option
				.setName("users")
				.setDescription(`Users to sync the message to`)
				.setRequired(true),
		),
	new SlashCommandBuilder()
		.setName("forward")
		.setDescription(
			"Forward all messages sent to the bot to a designated channel",
		)
		.addChannelOption(option =>
			option
				.setName("channel")
				.setDescription("The channel to forward messages to")
				.setRequired(true),
		),
];

// Handle slash command
client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isCommand()) return;

	if (interaction.commandName === "sync") {
		// Split the users option string into an array of user IDs
		const users = (
			interaction.options
				.get("users", true)
				.value?.toString()
				.split(" ") ?? []
		)
			.map(mention => mention.replace(/[<@!>]/g, ""))
			// Fetch the users from the cache
			.map(id => {
				try {
					return client.users.cache.get(id);
				} catch (error) {
					return undefined;
				}
			})
			// Filter out any users that couldn't be found
			.filter((u): u is User => !!u);

		if (users.length === 0) {
			await interaction.reply({
				ephemeral: true,
				content: "Couldn't find any users!",
			});
			return;
		}

		const messageId = interaction.options.get("message", true)
			.value as string;

		// fetch the message from any channel
		const source = await client.channels.cache.reduce(
			async (prev, channel) => {
				if (await prev) return prev;
				if (!channel.isTextBased()) return prev;

				try {
					return await channel.messages.fetch(messageId);
				} catch (error) {
					return prev;
				}
			},
			Promise.resolve<Message | undefined>(undefined),
		);

		if (!source) {
			await interaction.reply({
				ephemeral: true,
				content: "Couldn't find that message!",
			});
			return;
		}

		// Send the message to each user
		for (const user of users) {
			const dmChannel = await user.createDM();
			const sent = await dmChannel.send(source.content);

			synced.push({
				source,
				sent,
			});
		}

		await interaction.reply({
			ephemeral: true,
			content: `Sent message to ${users.length} users: \`\`\`${source.content}\`\`\``,
		});

		console.info(
			`Sent message ${source.id} to ${users.length} users: ${users
				.map(u => u.username)
				.join(", ")}`,
		);
	} else if (interaction.commandName === "forward") {
		const channel = interaction.options.get("channel", true).channel;
		if (!channel) {
			await interaction.reply({
				ephemeral: true,
				content: "Couldn't find that channel!",
			});
			return;
		}

		if (channel?.type !== ChannelType.GuildText) {
			await interaction.reply({
				ephemeral: true,
				content: "That channel isn't a text channel!",
			});
			return;
		}

		forwardChannel = channel.id;
		await interaction.reply({
			ephemeral: true,
			content: `Forwarding messages to ${channel.toString()}`,
		});

		console.info(`Forwarding messages to ${channel.toString()}`);
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
			body: commands.map(command => command.toJSON()),
		});

		console.info("Successfully reloaded application (/) commands.");
	} catch (error) {
		console.error(error);
	}
})();

// Handle message updates
client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
	if (oldMessage.partial || newMessage.partial) return;
	if (oldMessage.content === newMessage.content) return;

	if (!synced) return;

	// Find all synced messages that match the old message
	const syncedMessages = synced.filter(m => m.source.id === oldMessage.id);
	if (!syncedMessages) return;

	// Update all synced messages
	for (const syncedMessageSource of syncedMessages) {
		await syncedMessageSource.sent.edit(newMessage.content);
	}

	if (syncedMessages.length === 0) return;
	await newMessage.reply({
		content: `Updated synced message to ${syncedMessages.length} users: \`\`\`${newMessage.content}\`\`\``,
	});

	console.info(
		`Updated synced message ${oldMessage.id} to ${
			syncedMessages.length
		} users: ${syncedMessages.map(m => m.sent.author.username).join(", ")}`,
	);
});

// Handle direct messages
client.on(Events.MessageCreate, async message => {
	// Ignore bots
	if (message.author.bot) return;
	// Only show messages from DMs
	if (message.channel.type !== ChannelType.DM) return;

	// Only forward messages if a channel has been set
	if (!forwardChannel) return;
	let channel;
	try {
		channel = await client.channels.fetch(forwardChannel);
	} catch (error) {
		return;
	}
	if (!channel) return;
	if (!channel.isTextBased()) return;

	await channel.send({
		content: message.content,
		files: message.attachments.map(a => ({
			name: a.name,
			attachment: a.url,
		})),
	});

	console.info(`Forwarded message from ${message.author.username}`);
});

void client.login(process.env.TOKEN);

type SyncedMessage = {
	source: Message;
	sent: Message;
};
