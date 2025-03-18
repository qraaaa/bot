const { Client, GatewayIntentBits, Events, EmbedBuilder, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Ścieżka do pliku z danymi
const DATA_PATH = path.join(__dirname, 'bot-data.json');

// Lista autoryzowanych użytkowników (ID)
const authorizedUsers = ['414798947932962816', '672084099946643469'];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Dane bota
let botData = {
  invites: {},
  memberJoinInfo: {},
  commandChannels: {}, // Kanały dla zaproszeń
  botInfoChannels: {},
  ticketChannels: {}, // Kanały dla ticketów
  dropChannels: {}, // Kanały dla dropów
  userDrops: {},
  giveaways: {} // Informacje o ostatnich dropach użytkowników
};

// Funkcja do ładowania danych z pliku
function loadData() {
  try {
    if (fs.existsSync(DATA_PATH)) {
      const data = fs.readFileSync(DATA_PATH, 'utf8');
      botData = JSON.parse(data);
      console.log('Dane zostały wczytane z pliku');
      
      // Inicjalizujemy obiekt ticketChannels jeśli nie istnieje
      if (!botData.ticketChannels) {
        botData.ticketChannels = {};
        saveData();
      }
      if (!botData.dropChannels) {
        botData.dropChannels = {};
        saveData();
      }
      
      if (!botData.userDrops) {
        botData.userDrops = {};
        saveData();
      }
      
      if (!botData.botInfoChannels) {
        botData.botInfoChannels = {};
        saveData();
      }

      if (!botData.giveaways) {
        botData.giveaways = {};
        saveData();
      }
    }
  } catch (error) {
    console.error('Błąd podczas wczytywania danych:', error);
  }
}

// Funkcja do zapisywania danych do pliku
function saveData() {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(botData, null, 2), 'utf8');
  } catch (error) {
    console.error('Błąd podczas zapisywania danych:', error);
  }
}

// Funkcja do ładowania wszystkich zaproszeń
async function loadInvites() {
  client.guilds.cache.forEach(async (guild) => {
    try {
      const guildInvites = await guild.invites.fetch();
      
      if (!botData.invites[guild.id]) {
        botData.invites[guild.id] = {};
      }
      
      guildInvites.forEach(invite => {
        botData.invites[guild.id][invite.code] = invite.uses;
      });
      
      saveData(); // Zapisujemy dane po aktualizacji
    } catch (error) {
      console.error(`Nie można załadować zaproszeń dla serwera ${guild.name}:`, error);
    }
  });
}

// Funkcja do rejestracji komend slash
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('kanal-zaproszen')
      .setDescription('Ustawia kanał, na którym będą wyświetlane informacje o zaproszeniach')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    new SlashCommandBuilder()
      .setName('kanal-ticket')
      .setDescription('Ustawia kanał, na którym będzie wyświetlany panel do tworzenia ticketów')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
      .setName('czysc')
      .setDescription('Czyści określoną liczbę wiadomości na kanale')
      .addIntegerOption(option => 
      option.setName('liczba')
      .setDescription('Liczba wiadomości do usunięcia')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(100))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
      .setName('drop-kanal')
      .setDescription('Ustawia kanał, na którym będzie można używać komendy /drop')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

      new SlashCommandBuilder()
      .setName('kanal-info')
      .setDescription('Ustawia kanał, na którym będą wyświetlane informacje o bocie')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),    

    new SlashCommandBuilder()
      .setName('drop')
      .setDescription('Losuje zniżkę na zakupy'),

    new SlashCommandBuilder()
      .setName('wiadomosc')
      .setDescription('Wysyła wiadomość jako embed')
      .addStringOption(option => 
        option.setName('tytul')
        .setDescription('Tytuł wiadomości')
        .setRequired(true))
      .addStringOption(option => 
        option.setName('tresc')
        .setDescription('Treść wiadomości \\n nowa linia')
        .setRequired(true))
      .addStringOption(option => 
        option.setName('kolor')
        .setDescription('Kolor embeda (np. #FF0000, red, blue, green)')
        .setRequired(false))
      .addStringOption(option => 
        option.setName('stopka')
        .setDescription('Tekst w stopce embeda')
        .setRequired(false))
      .addStringOption(option => 
        option.setName('obrazek')
        .setDescription('URL obrazka do wyświetlenia w embedzie')
        .setRequired(false))
      .addStringOption(option => 
        option.setName('miniaturka')
        .setDescription('URL miniaturki do wyświetlenia w embedzie')
        .setRequired(false))
      .addBooleanOption(option =>
        option.setName('ukryj')
        .setDescription('Czy ukryć potwierdzenie wysłania wiadomości')
        .setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

      new SlashCommandBuilder()
  .setName('giveaway-start')
  .setDescription('Rozpoczyna nowy giveaway')
  .addStringOption(option => 
    option.setName('nagroda')
    .setDescription('Co można wygrać w giveawayu')
    .setRequired(true))
  .addIntegerOption(option => 
    option.setName('czas')
    .setDescription('Czas trwania giveawaya w minutach (0 = bez limitu czasu)')
    .setRequired(true)
    .setMinValue(0))
  .addIntegerOption(option => 
    option.setName('zwyciezcy')
    .setDescription('Liczba zwycięzców')
    .setRequired(true)
    .setMinValue(1)
    .setMaxValue(10))
  .addStringOption(option => 
    option.setName('opis')
    .setDescription('Dodatkowy opis giveawaya')
    .setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

new SlashCommandBuilder()
  .setName('giveaway-end')
  .setDescription('Kończy giveaway i losuje zwycięzców')
  .addStringOption(option => 
    option.setName('id')
    .setDescription('ID wiadomości giveawaya')
    .setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

new SlashCommandBuilder()
  .setName('giveaway-reroll')
  .setDescription('Losuje nowych zwycięzców giveawaya')
  .addStringOption(option => 
    option.setName('id')
    .setDescription('ID wiadomości giveawaya')
    .setRequired(true))
  .addIntegerOption(option => 
    option.setName('liczba')
    .setDescription('Liczba nowych zwycięzców (domyślnie 1)')
    .setRequired(false)
    .setMinValue(1)
    .setMaxValue(10))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  ];
  
  try {
    console.log('Rejestracja komend slash...');
    
    const rest = new REST({ version: '10' }).setToken(client.token);
    
    for (const guild of client.guilds.cache.values()) {
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, guild.id),
        { body: commands }
      );
    }
    
    console.log('Komendy slash zostały zarejestrowane!');
  } catch (error) {
    console.error('Błąd podczas rejestracji komend slash:', error);
  }
}

// Kiedy bot jest gotowy
client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Bot gotowy! Zalogowany jako ${readyClient.user.tag}`);
  
  // Wczytujemy dane z pliku
  loadData();
  
  // Ładujemy istniejące zaproszenia
  await loadInvites();
  
  // Rejestrujemy komendy slash
  await registerCommands();
  
  // Wysyłamy wiadomość startową
  console.log('Bot uruchomiony i gotowy do pracy!');
  
  // Wysyłamy wiadomość na zapisane kanały
  for (const guildId in botData.botInfoChannels) {
    const channelId = botData.botInfoChannels[guildId];
    const channel = client.channels.cache.get(channelId);
    
    if (channel) {
      const startEmbed = new EmbedBuilder()
        .setColor(0x00FFFF)
        .setTitle('🤖 Bot Uruchomiony')
        .setDescription('**Bot został uruchomiony i jest gotowy do pracy!**')
        .setFooter({ text: 'System informacyjny' })
        .setTimestamp();
      
      channel.send({ embeds: [startEmbed] });
    }
  }
});

// Obsługa dołączenia nowego członka
client.on(Events.GuildMemberAdd, async (member) => {
  const guild = member.guild;
  try {
    const newInvites = await guild.invites.fetch();
    const oldInvites = botData.invites[guild.id] || {};
    
    // Znajdujemy zaproszenie, które zostało wykorzystane
    let usedInvite = null;
    let inviter = null;
    
    for (const invite of newInvites.values()) {
      const oldUses = oldInvites[invite.code] || 0;
      if (invite.uses > oldUses) {
        usedInvite = invite;
        inviter = invite.inviter;
        break;
      }
    }
    
    // Inicjalizujemy tablicę dla gildii, jeśli nie istnieje
    if (!botData.memberJoinInfo[guild.id]) {
      botData.memberJoinInfo[guild.id] = [];
    }
    
    // Inicjalizujemy listę wcześniej dołączających członków, jeśli nie istnieje
    if (!botData.previousMembers) {
      botData.previousMembers = {};
    }
    
    if (!botData.previousMembers[guild.id]) {
      botData.previousMembers[guild.id] = [];
    }
    
    // Sprawdzamy, czy użytkownik wcześniej dołączał do serwera
    const previouslyJoined = botData.previousMembers[guild.id].includes(member.id);
    
    // Dodajemy nowego członka do listy, jeśli jeszcze tam nie jest
    if (!previouslyJoined) {
      botData.previousMembers[guild.id].push(member.id);
    }
    
    // Pobieramy ID kanału powiadomień
    const channelId = botData.commandChannels[guild.id];
    const channel = channelId ? guild.channels.cache.get(channelId) : null;
    
    // Logika dla użytkownika z zaproszeniem
    if (inviter) {
      // Liczymy zaproszenia tylko jeśli użytkownik nie dołączał wcześniej
      const inviteCount = previouslyJoined ? 
        // Jeśli dołączał wcześniej, utrzymujemy poprzednią liczbę
        Array.from(newInvites.values())
          .filter(invite => invite.inviter && invite.inviter.id === inviter.id)
          .reduce((total, invite) => total + invite.uses, 0) - 1 :
        // Jeśli to nowy użytkownik, zwiększamy liczbę zaproszeń
        Array.from(newInvites.values())
          .filter(invite => invite.inviter && invite.inviter.id === inviter.id)
          .reduce((total, invite) => total + invite.uses, 0);
      
      // Dodajemy nowe informacje o członku
      botData.memberJoinInfo[guild.id].push({
        memberId: member.id,
        memberTag: member.user.tag,
        memberAvatar: member.user.displayAvatarURL({ dynamic: true }),
        inviterId: inviter.id,
        inviterTag: inviter.tag,
        inviteCount: inviteCount,
        joinedAt: new Date().toISOString(),
        previouslyJoined: previouslyJoined
      });
      
      // Ograniczamy liczbę zapisanych informacji do 10 ostatnich
      if (botData.memberJoinInfo[guild.id].length > 10) {
        botData.memberJoinInfo[guild.id].shift(); // Usuwamy najstarszy wpis
      }
      
      // Wysyłamy powiadomienie na kanał
      if (channel) {
        const welcomeEmbed = new EmbedBuilder()
          .setColor(previouslyJoined ? 0xFFA500 : 0x00FF00) // Pomarańczowy dla powracających, zielony dla nowych
          .setTitle(previouslyJoined ? '🔄 Powracający Członek Serwera!' : '👋 Nowy Członek Serwera!')
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
          .addFields(
            { name: '🎮 Użytkownik', value: `**${member.user.tag}**`, inline: true },
            { name: '🔗 Zaproszony przez', value: `**${inviter.tag}**`, inline: true },
            { name: '🏆 Liczba zaproszeń', value: `**${inviteCount}**`, inline: true }
          );
        
        if (previouslyJoined) {
          welcomeEmbed.addFields({ name: '📝 Uwaga', value: '**Ten użytkownik dołączał już wcześniej do serwera**', inline: false });
        }
        
        welcomeEmbed.setFooter({ text: `ID: ${member.id}` }).setTimestamp();
        
        channel.send({ embeds: [welcomeEmbed] });
      }
    } 
    // Logika dla użytkownika bez konkretnego zaproszenia
    else {
      // Dodajemy nowe informacje o członku bez osoby zapraszającej
      botData.memberJoinInfo[guild.id].push({
        memberId: member.id,
        memberTag: member.user.tag,
        memberAvatar: member.user.displayAvatarURL({ dynamic: true }),
        inviterId: null,
        inviterTag: "Link niestandardowy",
        inviteCount: 0,
        joinedAt: new Date().toISOString(),
        previouslyJoined: previouslyJoined
      });
      
      // Ograniczamy liczbę zapisanych informacji do 10 ostatnich
      if (botData.memberJoinInfo[guild.id].length > 10) {
        botData.memberJoinInfo[guild.id].shift(); // Usuwamy najstarszy wpis
      }
      
      // Wysyłamy powiadomienie na kanał
      if (channel) {
        const welcomeEmbed = new EmbedBuilder()
          .setColor(previouslyJoined ? 0xFFA500 : 0x00FFFF) // Pomarańczowy dla powracających, niebieski dla nowych
          .setTitle(previouslyJoined ? '🔄 Powracający Członek Serwera!' : '👋 Nowy Członek Serwera!')
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
          .addFields(
            { name: '🎮 Użytkownik', value: `**${member.user.tag}**`, inline: true },
            { name: '🔗 Metoda dołączenia', value: '**Link niestandardowy**', inline: true }
          );
        
        if (previouslyJoined) {
          welcomeEmbed.addFields({ name: '📝 Uwaga', value: '**Ten użytkownik dołączał już wcześniej do serwera**', inline: false });
        }
        
        welcomeEmbed.setFooter({ text: `ID: ${member.id}` }).setTimestamp();
        
        channel.send({ embeds: [welcomeEmbed] });
      }
    }
    
    // Aktualizujemy naszą bazę zaproszeń
    if (!botData.invites[guild.id]) {
      botData.invites[guild.id] = {};
    }
    
    for (const invite of newInvites.values()) {
      botData.invites[guild.id][invite.code] = invite.uses;
    }
    
    // Zapisujemy dane
    saveData();
    
  } catch (error) {
    console.error(`Błąd podczas przetwarzania nowego członka ${member.user.tag}:`, error);
  }
});

// Funkcja do utworzenia i wysłania panelu ticketów
async function sendTicketPanel(channel) {
  const ticketEmbed = new EmbedBuilder()
    .setColor(0xE67E22)
    .setTitle('🎫 System Ticketów')
    .setDescription('**Aby zamówić wybrany produkt, stwórz ticket i napisz co chcesz kupić.**')
    .setFooter({ text: 'Kliknij przycisk poniżej, aby utworzyć ticket' })
    .setTimestamp();

  // Tworzymy przycisk
  const ticketButton = new ButtonBuilder()
    .setCustomId('create_ticket')
    .setLabel('Stwórz Ticket')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('🎫');

  const row = new ActionRowBuilder().addComponents(ticketButton);

  // Wysyłamy embed z przyciskiem
  return channel.send({
    embeds: [ticketEmbed],
    components: [row]
  });
}

// Obsługa komend slash
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isCommand()) {
    const { commandName, user, guild, channelId } = interaction;
    
    // Sprawdzamy, czy użytkownik jest autoryzowany
    if (!authorizedUsers.includes(user.id) && commandName !== 'drop') {
      return interaction.reply({ 
        content: '⛔ Nie masz uprawnień do używania tej komendy!', 
        flags: { ephemeral: true } // zmienione z ephemeral: true
      });
    }
    
    // Obsługa komendy kanal-zaproszen
    if (commandName === 'kanal-zaproszen') {
      await interaction.deferReply();
      
      // Zapisujemy kanał, na którym użyto komendy
      botData.commandChannels[guild.id] = channelId;
      saveData();
      
      // Pobieramy nazwę kanału
      const channel = guild.channels.cache.get(channelId);
      const channelName = channel ? channel.name : 'ten kanał';
      
      // Tworzymy embed potwierdzający ustawienie kanału
      const confirmEmbed = new EmbedBuilder()
        .setColor(0x00FFFF)
        .setTitle('✅ Kanał powiadomień ustawiony')
        .setDescription(`Od teraz informacje o nowych członkach będą wyświetlane na kanale **#${channelName}**`)
        .setFooter({ text: 'System zaproszeń' })
        .setTimestamp();
      
      await interaction.editReply({ embeds: [confirmEmbed] });
      
      // Wyświetlamy ostatnie zaproszenia, jeśli istnieją
      const memberInfoList = botData.memberJoinInfo[guild.id] || [];
      
      if (memberInfoList.length > 0) {
        const historyEmbed = new EmbedBuilder()
          .setColor(0x4682B4)
          .setTitle('📊 Historia ostatnich zaproszeń')
          .setDescription(`Oto lista ostatnich ${memberInfoList.length} osób, które dołączyły do serwera:`)
          .setFooter({ text: 'System zaproszeń' })
          .setTimestamp();
        
        // Dodajemy pola dla każdego użytkownika (max 10 pól)
        memberInfoList.slice(0, 10).forEach((info, index) => {
          const joinDate = new Date(info.joinedAt);
          historyEmbed.addFields({
            name: `${index + 1}. ${info.memberTag}`,
            value: `👤 Zaproszony przez: **${info.inviterTag}**\n🔢 Liczba zaproszeń: **${info.inviteCount}**\n🕒 Dołączył: <t:${Math.floor(joinDate.getTime() / 1000)}:R>`,
            inline: false
          });
        });
        
        await interaction.channel.send({ embeds: [historyEmbed] });
      }
    }
    
    // Obsługa komendy kanal-ticket
    else if (commandName === 'kanal-ticket') {
      await interaction.deferReply();
      
      // Zapisujemy kanał, na którym użyto komendy
      if (!botData.ticketChannels[guild.id]) {
        botData.ticketChannels[guild.id] = {};
      }
      botData.ticketChannels[guild.id].panelChannelId = channelId;
      saveData();
      
      // Pobieramy nazwę kanału
      const channel = guild.channels.cache.get(channelId);
      const channelName = channel ? channel.name : 'ten kanał';
      
      // Tworzymy embed potwierdzający ustawienie kanału
      const confirmEmbed = new EmbedBuilder()
        .setColor(0xE67E22)
        .setTitle('✅ Kanał ticketów ustawiony')
        .setDescription(`Panel do tworzenia ticketów został ustawiony na kanale **#${channelName}**`)
        .setFooter({ text: 'System ticketów' })
        .setTimestamp();
      
      await interaction.editReply({ embeds: [confirmEmbed] });
      
      // Wysyłamy panel do tworzenia ticketów
      await sendTicketPanel(channel);
    }
    else if (commandName === 'czysc') {
      // Sprawdzamy, czy użytkownik jest autoryzowany
      if (!authorizedUsers.includes(user.id)) {
        return interaction.reply({ 
          content: '⛔ Nie masz uprawnień do używania tej komendy!', 
          ephemeral: true 
        });
      }
      
      const liczba = interaction.options.getInteger('liczba');
      
      await interaction.deferReply({ ephemeral: true });
      
      try {
        // Pobieramy wiadomości do usunięcia
        const messages = await interaction.channel.messages.fetch({ limit: liczba });
        
        // Usuwamy wiadomości
        await interaction.channel.bulkDelete(messages, true);
        
        // Potwierdzamy usunięcie
        await interaction.editReply({ 
          content: `✅ Usunięto ${messages.size} wiadomości.`, 
          ephemeral: true 
        });
      } catch (error) {
        console.error('Błąd podczas usuwania wiadomości:', error);
        await interaction.editReply({ 
          content: `❌ Wystąpił błąd podczas usuwania wiadomości: ${error.message}`, 
          ephemeral: true 
        });
      }
    }
    
    // Obsługa komendy drop-kanal
    else if (commandName === 'drop-kanal') {
      // Sprawdzamy, czy użytkownik jest autoryzowany
      if (!authorizedUsers.includes(user.id)) {
        return interaction.reply({ 
          content: '⛔ Nie masz uprawnień do używania tej komendy!', 
          ephemeral: true 
        });
      }
      
      await interaction.deferReply();
      
      // Zapisujemy kanał dla dropów
      if (!botData.dropChannels) {
        botData.dropChannels = {};
      }
      
      botData.dropChannels[guild.id] = channelId;
      saveData();
      
      // Pobieramy nazwę kanału
      const channel = guild.channels.cache.get(channelId);
      const channelName = channel ? channel.name : 'ten kanał';
      
      // Tworzymy embed potwierdzający ustawienie kanału
      const confirmEmbed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle('✅ Kanał dropów ustawiony')
        .setDescription(`Komenda /drop została włączona na kanale **#${channelName}**`)
        .setFooter({ text: 'System dropów' })
        .setTimestamp();
      
      await interaction.editReply({ embeds: [confirmEmbed] });
    }
    
    // Obsługa komendy kanal-info
else if (commandName === 'kanal-info') {
  // Sprawdzamy, czy użytkownik jest autoryzowany
  if (!authorizedUsers.includes(user.id)) {
    return interaction.reply({ 
      content: '⛔ Nie masz uprawnień do używania tej komendy!', 
      ephemeral: true 
    });
  }
  
  await interaction.deferReply();
  
  // Zapisujemy kanał, na którym użyto komendy
  botData.botInfoChannels[guild.id] = channelId;
  saveData();
  
  // Pobieramy nazwę kanału
  const channel = guild.channels.cache.get(channelId);
  const channelName = channel ? channel.name : 'ten kanał';
  
  // Tworzymy embed potwierdzający ustawienie kanału
  const confirmEmbed = new EmbedBuilder()
    .setColor(0x00FFFF)
    .setTitle('✅ Kanał informacyjny ustawiony')
    .setDescription(`Od teraz informacje o bocie będą wyświetlane na kanale **#${channelName}**`)
    .setFooter({ text: 'System info' })
    .setTimestamp();
  
  await interaction.editReply({ embeds: [confirmEmbed] });
}
    
    // Obsługa komendy wiadomosc
else if (commandName === 'wiadomosc') {
  // Sprawdzamy, czy użytkownik jest autoryzowany
  if (!authorizedUsers.includes(user.id)) {
    return interaction.reply({ 
      content: '⛔ Nie masz uprawnień do używania tej komendy!', 
      ephemeral: true 
    });
  }
  
  const tytul = interaction.options.getString('tytul');
  const tresc = interaction.options.getString('tresc');
  const przetworzonyTresc = tresc.replace(/\\n/g, '\n');
  const kolor = interaction.options.getString('kolor') || '0x3498DB'; // Domyślny kolor (niebieski)
  const stopka = interaction.options.getString('stopka') || 'Wiadomość systemowa';
  const obrazekUrl = interaction.options.getString('obrazek');
  const miniaturkaUrl = interaction.options.getString('miniaturka');
  const ukryj = interaction.options.getBoolean('ukryj') || false;
  
  // Konwersja koloru na format hex
  let kolorHex;
  try {
    // Jeśli podano nazwę koloru lub kod hex z #
    if (kolor.startsWith('#')) {
      kolorHex = parseInt(kolor.replace('#', '0x'), 16);
    } else if (kolor.startsWith('0x')) {
      kolorHex = parseInt(kolor, 16);
    } else {
      // Podstawowe kolory
      const kolorMap = {
        'red': 0xFF0000,
        'green': 0x00FF00,
        'blue': 0x0000FF,
        'yellow': 0xFFFF00,
        'purple': 0x800080,
        'orange': 0xFFA500,
        'black': 0x000000,
        'white': 0xFFFFFF,
        'cyan': 0x00FFFF,
        'pink': 0xFFC0CB
      };
      kolorHex = kolorMap[kolor.toLowerCase()] || 0x3498DB;
    }
  } catch (error) {
    kolorHex = 0x3498DB; // Domyślny kolor jeśli wystąpił błąd
  }
  
  // Tworzymy embed z wiadomością
  const messageEmbed = new EmbedBuilder()
    .setColor(kolorHex)
    .setTitle(tytul)
    .setDescription(przetworzonyTresc)
    .setFooter({ text: stopka })
    .setTimestamp();
  
  // Dodajemy obrazek, jeśli został podany
  if (obrazekUrl) {
    messageEmbed.setImage(obrazekUrl);
  }
  
  // Dodajemy miniaturkę, jeśli została podana
  if (miniaturkaUrl) {
    messageEmbed.setThumbnail(miniaturkaUrl);
  }
  
  await interaction.deferReply({ ephemeral: true });
  
  // Wysyłamy embed na kanał
  await interaction.channel.send({ embeds: [messageEmbed] });
  
  // Potwierdzamy wysłanie wiadomości
  await interaction.editReply({ 
    content: '✅ Wiadomość została wysłana!', 
    ephemeral: ukryj 
  });
}

    // Obsługa komendy drop
    else if (commandName === 'drop') {
      const dropChannelId = botData.dropChannels[guild.id];
      
      // Sprawdzamy, czy komenda jest używana na właściwym kanale
      if (channelId !== dropChannelId) {
        const dropChannel = guild.channels.cache.get(dropChannelId);
        return interaction.reply({ 
          content: `⚠️ Tej komendy można używać tylko na kanale ${dropChannel ? `<#${dropChannelId}>` : 'drops'}!`, 
          ephemeral: true 
        });
      }
      
      
      // Inicjalizujemy obiekty, jeśli nie istnieją
      if (!botData.userDrops) {
        botData.userDrops = {};
      }
      
      if (!botData.userDrops[guild.id]) {
        botData.userDrops[guild.id] = {};
      }
      
      const userId = user.id;
      const currentTime = Date.now();
      const lastDropTime = botData.userDrops[guild.id][userId] || 0;
      const cooldownTime = 3 * 60 * 60 * 1000; // 3 godziny w milisekundach
      
      // Sprawdzamy, czy użytkownik nie jest na cooldownie
      if (currentTime - lastDropTime < cooldownTime) {
        const remainingTime = new Date(lastDropTime + cooldownTime);
        return interaction.reply({ 
          content: `⏰ Możesz użyć komendy /drop ponownie <t:${Math.floor(remainingTime / 1000)}:R>`, 
          ephemeral: true 
        });
      }
      
      // Aktualizujemy czas ostatniego użycia
      botData.userDrops[guild.id][userId] = currentTime;
      saveData();
      
      // Losowanie zniżki (30% szans na wygraną, po 10% na każdą zniżkę)
      const random = Math.random() * 100;
      let discount = null;
      
      if (random < 10) {
        discount = '10%';
      } else if (random < 20) {
        discount = '15%';
      } else if (random < 30) {
        discount = '20%';
      }
      
      // Tworzymy odpowiedni embed
      let dropEmbed;
      
      if (discount) {
        // Embed dla wygranej
        dropEmbed = new EmbedBuilder()
          .setColor(0x2ECC71)
          .setTitle(`🎉 Wylosowano zniżkę ${discount}!`)
          .setDescription(`<@${userId}> wylosował(a) zniżkę **${discount}** na zakupy!\n\nZniżkę można wykorzystać przy zakupach o wartości co najmniej 20 zł.`)
          .setFooter({ text: 'System dropów • Ważne przez 24 godziny' })
          .setTimestamp();
      } else {
        // Embed dla przegranej
        dropEmbed = new EmbedBuilder()
          .setColor(0xE74C3C)
          .setTitle('😢 Niestety nic nie wylosowano')
          .setDescription(`<@${userId}> niestety tym razem nie udało się wylosować zniżki.\nSpróbuj ponownie za 3 godziny!`)
          .setFooter({ text: 'System dropów' })
          .setTimestamp();
      }
      
      await interaction.reply({ embeds: [dropEmbed] });
    }
    else if (commandName === 'giveaway-start') {
      // Sprawdzamy, czy użytkownik jest autoryzowany
      if (!authorizedUsers.includes(user.id)) {
        return interaction.reply({ 
          content: '⛔ Nie masz uprawnień do używania tej komendy!', 
          ephemeral: true 
        });
      }
      
      const nagroda = interaction.options.getString('nagroda');
      const czas = interaction.options.getInteger('czas');
      const zwyciezcy = interaction.options.getInteger('zwyciezcy');
      const opis = interaction.options.getString('opis') || '';
      
      await interaction.deferReply({ ephemeral: true });
      
      // Tworzymy datę zakończenia giveawaya (jeśli czas > 0)
      const endTime = czas > 0 ? new Date(Date.now() + czas * 60 * 1000) : null;
      const endTimeStamp = endTime ? Math.floor(endTime.getTime() / 1000) : null;
      
      // Tworzymy embed giveawaya
      const giveawayEmbed = new EmbedBuilder()
  .setColor(0x9B59B6)
  .setTitle('🎉 GIVEAWAY 🎉')
  .setDescription(`**Nagroda: ${nagroda}**`)
  .addFields(
    { name: '📝 Opis', value: opis || '*Brak opisu*', inline: false },
    { name: '👥 Liczba zwycięzców', value: `**${zwyciezcy}**`, inline: true },
    { name: '⏰ Zakończenie', value: endTime ? `<t:${endTimeStamp}:R>` : 'Ręcznie', inline: true }
  )
  .setImage('https://i.imgur.com/6xq9gA5.png') // Możesz dodać obrazek/banner giveawaya
  .setFooter({ text: `Giveaway ID: ${interaction.id} • Kliknij 🎉 aby wziąć udział!` })
  .setTimestamp();
      
      // Wysyłamy wiadomość z giveawayem
      const giveawayMessage = await interaction.channel.send({ embeds: [giveawayEmbed] });
      
      // Dodajemy reakcję
      await giveawayMessage.react('🎉');
      
      // Zapisujemy informacje o giveawayu
      if (!botData.giveaways[guild.id]) {
        botData.giveaways[guild.id] = {};
      }
      
      botData.giveaways[guild.id][giveawayMessage.id] = {
        prize: nagroda,
        description: opis,
        winners: zwyciezcy,
        endTime: endTime ? endTime.toISOString() : null,
        messageId: giveawayMessage.id,
        channelId: interaction.channelId,
        hostId: user.id,
        ended: false,
        winnerIds: []
      };
      
      saveData();
      
      // Potwierdzamy utworzenie giveawaya
      await interaction.editReply({ 
        content: `✅ Giveaway został utworzony! ID: ${giveawayMessage.id}`,
        ephemeral: true
      });
      
      // Jeśli czas jest ustawiony, planujemy zakończenie giveawaya
      if (endTime) {
        const timeoutId = setTimeout(async () => {
          await endGiveaway(guild.id, giveawayMessage.id);
        }, czas * 60 * 1000);
        
        // Możemy zapisać ID timeoutu, aby móc go anulować w razie potrzeby
      }
    }
    
    // Obsługa komendy giveaway-end
    else if (commandName === 'giveaway-end') {
      // Sprawdzamy, czy użytkownik jest autoryzowany
      if (!authorizedUsers.includes(user.id)) {
        return interaction.reply({ 
          content: '⛔ Nie masz uprawnień do używania tej komendy!', 
          ephemeral: true 
        });
      }
      
      const giveawayId = interaction.options.getString('id');
      
      await interaction.deferReply({ ephemeral: true });
      
      // Sprawdzamy czy giveaway istnieje
      if (!botData.giveaways[guild.id] || !botData.giveaways[guild.id][giveawayId]) {
        return interaction.editReply({ 
          content: `❌ Nie znaleziono giveawaya o ID: ${giveawayId}` 
        });
      }
      
      // Sprawdzamy czy giveaway nie został już zakończony
      if (botData.giveaways[guild.id][giveawayId].ended) {
        return interaction.editReply({ 
          content: `❌ Ten giveaway został już zakończony!` 
        });
      }
      
      // Kończymy giveaway
      const result = await endGiveaway(guild.id, giveawayId);
      
      if (result.success) {
        await interaction.editReply({ 
          content: `✅ Giveaway zakończony! ${result.winners.length > 0 ? `Zwycięzcy: ${result.winners.join(', ')}` : 'Brak uczestników.'}`,
          ephemeral: true
        });
      } else {
        await interaction.editReply({ 
          content: `❌ Wystąpił błąd: ${result.error}` 
        });
      }
    }
    
    // Obsługa komendy giveaway-reroll
    else if (commandName === 'giveaway-reroll') {
      // Sprawdzamy, czy użytkownik jest autoryzowany
      if (!authorizedUsers.includes(user.id)) {
        return interaction.reply({ 
          content: '⛔ Nie masz uprawnień do używania tej komendy!', 
          ephemeral: true 
        });
      }
      
      const giveawayId = interaction.options.getString('id');
      const liczba = interaction.options.getInteger('liczba') || 1;
      
      await interaction.deferReply({ ephemeral: true });
      
      // Sprawdzamy czy giveaway istnieje
      if (!botData.giveaways[guild.id] || !botData.giveaways[guild.id][giveawayId]) {
        return interaction.editReply({ 
          content: `❌ Nie znaleziono giveawaya o ID: ${giveawayId}` 
        });
      }
      
      // Sprawdzamy czy giveaway został już zakończony
      if (!botData.giveaways[guild.id][giveawayId].ended) {
        return interaction.editReply({ 
          content: `❌ Ten giveaway nie został jeszcze zakończony!` 
        });
      }
      
      // Losujemy nowych zwycięzców
      const result = await rerollGiveaway(guild.id, giveawayId, liczba);
      
      if (result.success) {
        await interaction.editReply({ 
          content: `✅ Nowi zwycięzcy: ${result.winners.length > 0 ? result.winners.join(', ') : 'Brak uczestników.'}` 
        });
      } else {
        await interaction.editReply({ 
          content: `❌ Wystąpił błąd: ${result.error}` 
        });
      }
    }
  }
  
  // Obsługa przycisku do tworzenia ticketu
  else if (interaction.isButton() && interaction.customId === 'create_ticket') {
    const { guild, user } = interaction;
    
    // Sprawdzamy czy kategoria ticketów istnieje, jeśli nie - tworzymy ją
    let ticketCategory = guild.channels.cache.find(
      channel => channel.type === ChannelType.GuildCategory && channel.name === '✧tickety✧'
    );
    
    if (!ticketCategory) {
      ticketCategory = await guild.channels.create({
        name: '✧tickety✧',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel]
          }
        ]
      });
    }
    
    // Tworzymy nazwę kanału dla ticketu
    const ticketChannelName = `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    
    // Sprawdzamy czy ticket dla tego użytkownika już istnieje
    const existingTicket = guild.channels.cache.find(
      channel => channel.name === ticketChannelName && channel.parentId === ticketCategory.id
    );
    
    if (existingTicket) {
      return interaction.reply({
        content: `⚠️ Masz już otwarty ticket! <#${existingTicket.id}>`,
        ephemeral: true
      });
    }
    
    // Tworzymy nowy kanał dla ticketu
    try {
      const ticketChannel = await guild.channels.create({
        name: ticketChannelName,
        type: ChannelType.GuildText,
        parent: ticketCategory.id,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          },
          {
            id: client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel, 
              PermissionFlagsBits.SendMessages, 
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageChannels  // Dodane uprawnienie
            ]
          }
        ]
      });
      
      if (!botData.ticketChannels[guild.id].activeTickets) {
        botData.ticketChannels[guild.id].activeTickets = [];
      }
      botData.ticketChannels[guild.id].activeTickets.push(ticketChannel.id);
      saveData();

      // Wysyłamy wiadomość potwierdzającą utworzenie ticketu
      await interaction.reply({
        content: `✅ Stworzono ticket #${ticketChannelName}`,
        ephemeral: true
      });
      
      // Wysyłamy wiadomość powitalną na nowym kanale
      const welcomeEmbed = new EmbedBuilder()
        .setColor(0xE67E22)
        .setTitle('🎫 Nowy Ticket')
        .setDescription(`Hej <@${user.id}>! Napisz jaki produkt chcesz kupić lub jaki masz problem!`)
        .setFooter({ text: 'Wsparcie odpowie tak szybko, jak to możliwe' })
        .setTimestamp();
      
      const closeButton = new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('Zamknij Ticket')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔒');
      
      const row = new ActionRowBuilder().addComponents(closeButton);
      
      await ticketChannel.send({
        content: `<@${user.id}>`,
        embeds: [welcomeEmbed],
        components: [row]
      });
      
    } catch (error) {
      console.error('Błąd podczas tworzenia ticketu:', error);
      await interaction.reply({
        content: '❌ Wystąpił błąd podczas tworzenia ticketu. Spróbuj ponownie później.',
        ephemeral: true
      });
    }
  }
  
  // Obsługa przycisku zamykania ticketu
  else if (interaction.isButton() && interaction.customId === 'close_ticket') {
    const { channel, guild } = interaction;
    
    // Sprawdzamy, czy kanał jest w naszej liście ticketów
    if (botData.ticketChannels[guild.id] && 
        botData.ticketChannels[guild.id].activeTickets &&
        botData.ticketChannels[guild.id].activeTickets.includes(channel.id)) {
      
      try {
        await interaction.reply({
          content: '🔒 Zamykanie ticketu...',
          ephemeral: false
        });
        
        // Tworzymy embed z informacją o zamknięciu
        const closeEmbed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('🔒 Ticket Zamknięty')
          .setDescription(`Ticket został zamknięty przez <@${interaction.user.id}>`)
          .setFooter({ text: 'Ticket zostanie usunięty za 5 sekund' })
          .setTimestamp();
        
        await channel.send({ embeds: [closeEmbed] });
        
        // Usuwamy kanał po 5 sekundach
        setTimeout(async () => {
          try {
            // Usuń ID kanału z naszej listy
            if (botData.ticketChannels[guild.id].activeTickets) {
              const index = botData.ticketChannels[guild.id].activeTickets.indexOf(channel.id);
              if (index > -1) {
                botData.ticketChannels[guild.id].activeTickets.splice(index, 1);
                saveData();
              }
            }
            
            await channel.delete(`Zamknięty przez ${interaction.user.tag}`);
          } catch (error) {
            console.error('Błąd podczas usuwania kanału:', error);
            if (channel.isTextBased()) {
              channel.send('❌ Wystąpił błąd podczas usuwania kanału. Sprawdź uprawnienia bota.');
            }
          }
        }, 5000);
      } catch (error) {
        console.error('Błąd podczas zamykania ticketu:', error);
        try {
          interaction.followUp({
            content: '❌ Wystąpił błąd podczas zamykania ticketu.',
            ephemeral: true
          });
        } catch (followUpError) {
          console.error('Nie można wysłać powiadomienia o błędzie:', followUpError);
        }
      }
    } else {
      // Opcjonalnie możesz dodać wiadomość, że nie jest to kanał ticketu
      interaction.reply({
        content: '❌ Ten kanał nie jest aktywnym ticketem lub nie został utworzony przez bota.',
        ephemeral: true
      });
    }
  }
  async function endGiveaway(guildId, messageId) {
    try {
      // Pobieramy dane giveawaya
      const giveaway = botData.giveaways[guildId][messageId];
      if (!giveaway) {
        return { success: false, error: 'Nie znaleziono giveawaya' };
      }
      
      // Jeśli giveaway został już zakończony
      if (giveaway.ended) {
        return { success: false, error: 'Ten giveaway został już zakończony' };
      }
      
      // Pobieramy kanał i wiadomość
      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        return { success: false, error: 'Nie znaleziono serwera' };
      }
      
      const channel = guild.channels.cache.get(giveaway.channelId);
      if (!channel) {
        return { success: false, error: 'Nie znaleziono kanału' };
      }
      
      try {
        const message = await channel.messages.fetch(messageId);
        
        // Pobieramy reakcje
        const reaction = message.reactions.cache.get('🎉');
        if (!reaction) {
          return { success: false, error: 'Nie znaleziono reakcji' };
        }
        
        // Pobieramy wszystkich użytkowników, którzy zareagowali
        await reaction.users.fetch();
        let participants = Array.from(reaction.users.cache.values())
          .filter(user => !user.bot); // Filtrujemy boty
        
        // Oznaczamy giveaway jako zakończony
        giveaway.ended = true;
        giveaway.endedAt = new Date().toISOString();
        
        // Losujemy zwycięzców
        const winnerCount = Math.min(giveaway.winners, participants.length);
        const winners = [];
        const winnerIds = [];
        
        for (let i = 0; i < winnerCount; i++) {
          if (participants.length === 0) break;
          
          // Losujemy zwycięzcę
          const winnerIndex = Math.floor(Math.random() * participants.length);
          const winner = participants[winnerIndex];
          
          winners.push(`<@${winner.id}>`);
          winnerIds.push(winner.id);
          
          // Usuwamy zwycięzcę z listy uczestników
          participants.splice(winnerIndex, 1);
        }
        
        // Zapisujemy ID zwycięzców
        giveaway.winnerIds = winnerIds;
        saveData();
        
        // Aktualizujemy embed
        const endedEmbed = new EmbedBuilder()
  .setColor(0x9B59B6)
  .setTitle('🎉 GIVEAWAY ZAKOŃCZONY 🎉')
  .setDescription(`**Nagroda: ${giveaway.prize}**`)
  .addFields(
    { name: '📝 Opis', value: giveaway.description || '*Brak opisu*', inline: false },
    { name: '🏆 Zwycięzcy', value: winners.length > 0 ? winners.join(', ') : 'Brak zwycięzców', inline: false },
    { name: '👥 Uczestnicy', value: `${reaction.users.cache.size - 1}`, inline: true },
    { name: '🕒 Zakończono', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
  )  
  .setFooter({ text: `Giveaway ID: ${messageId}` })
  .setTimestamp();
        
        await message.edit({ embeds: [endedEmbed] });
        
        // Wysyłamy ogłoszenie o zwycięzcach
        if (winners.length > 0) {
          const message = winners.length === 1 
              ? `🎊 **GRATULACJE!** 🎊\n${winners[0]} wygrałeś: **${giveaway.prize}**!\nSkontaktuj się z <@${giveaway.hostId}> aby odebrać nagrodę.`
              : `🎊 **GRATULACJE!** 🎊\n${winners.join(', ')} wygraliście: **${giveaway.prize}**!\nSkontaktujcie się z <@${giveaway.hostId}> aby odebrać nagrodę.`;
      
          await channel.send({
              content: message,
              allowedMentions: { parse: ['users'] }
          });
      } else {
          await channel.send({
              content: `😢 **Niestety nikt nie wziął udziału w giveawayu dla** **${giveaway.prize}**!`
          });
      }
        
        return { success: true, winners: winners };
        
      } catch (error) {
        console.error('Błąd podczas pobierania wiadomości:', error);
        return { success: false, error: 'Nie można pobrać wiadomości giveawaya' };
      }
      
    } catch (error) {
      console.error('Błąd podczas kończenia giveawaya:', error);
      return { success: false, error: 'Wystąpił błąd podczas kończenia giveawaya' };
    }
  }
  
  // Funkcja do ponownego losowania zwycięzców
  async function rerollGiveaway(guildId, messageId, winnerCount = 1) {
    try {
      // Pobieramy dane giveawaya
      const giveaway = botData.giveaways[guildId][messageId];
      if (!giveaway) {
        return { success: false, error: 'Nie znaleziono giveawaya' };
      }
      
      // Sprawdzamy czy giveaway został zakończony
      if (!giveaway.ended) {
        return { success: false, error: 'Ten giveaway nie został jeszcze zakończony' };
      }
      
      // Pobieramy kanał i wiadomość
      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        return { success: false, error: 'Nie znaleziono serwera' };
      }
      
      const channel = guild.channels.cache.get(giveaway.channelId);
      if (!channel) {
        return { success: false, error: 'Nie znaleziono kanału' };
      }
      
      try {
        const message = await channel.messages.fetch(messageId);
        
        // Pobieramy reakcje
        const reaction = message.reactions.cache.get('🎉');
        if (!reaction) {
          return { success: false, error: 'Nie znaleziono reakcji' };
        }
        
        // Pobieramy wszystkich użytkowników, którzy zareagowali
        await reaction.users.fetch();
        let participants = Array.from(reaction.users.cache.values())
          .filter(user => !user.bot); // Filtrujemy boty
        
        // Losujemy nowych zwycięzców
        const newWinnerCount = Math.min(winnerCount, participants.length);
        const winners = [];
        
        for (let i = 0; i < newWinnerCount; i++) {
          if (participants.length === 0) break;
          
          // Losujemy zwycięzcę
          const winnerIndex = Math.floor(Math.random() * participants.length);
          const winner = participants[winnerIndex];
          
          winners.push(`<@${winner.id}>`);
          
          // Usuwamy zwycięzcę z listy uczestników
          participants.splice(winnerIndex, 1);
        }
        
        // Wysyłamy ogłoszenie o nowych zwycięzcach
        if (winners.length > 0) {
          await channel.send({
            content: `🎊 Nowi zwycięzcy giveawaya **${giveaway.prize}**: ${winners.join(', ')}! Gratulacje!`,
            allowedMentions: { parse: ['users'] }
          });
        } else {
          await channel.send({
            content: `😢 Nie ma wystarczającej liczby uczestników, aby wylosować nowych zwycięzców dla giveawaya **${giveaway.prize}**!`
          });
        }
        
        return { success: true, winners: winners };
        
      } catch (error) {
        console.error('Błąd podczas pobierania wiadomości:', error);
        return { success: false, error: 'Nie można pobrać wiadomości giveawaya' };
      }
      
    } catch (error) {
      console.error('Błąd podczas rerollu giveawaya:', error);
      return { success: false, error: 'Wystąpił błąd podczas rerollu giveawaya' };
    }
  }
  
});

// Token bota 
