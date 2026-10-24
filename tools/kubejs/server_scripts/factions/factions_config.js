// priority: 1001
// Factions: the settings and faction definitions you can edit.
// factions_core.js does all the work and reads this file through global.FactionsConfigSource.
// The "priority" line above makes this file load before factions_core.js (priority 1000); keep it.
//
// After editing, run /reload. If this file has a mistake, the server log shows a [Factions] error and the
// last working version keeps being used (after a restart with a broken file, the built-in defaults are used).
// Note: KubeJS 6's script engine (Rhino) has no `template strings`, so strings are joined with +.
//
// Each faction:
//   id            short lowercase name used in commands and saved data (a-z, 0-9, _). Don't rename an id
//                 once players are in it, or they'll count as unregistered until you change it back.
//   displayName   full name shown to players
//   memberTitle   what members are called ("Loyalists")
//   color         a Minecraft colour name: gold, dark_red, gray, red, yellow, green, aqua, blue, ...
//   secret        true = membership is never shown to other players (only to admins and the member)
//   ranks         lowest first. New members get the first rank.
//   chatPrefix    shown in front of the player's name; %rank% and %title% are filled in. '' = none.
//                 Public factions: it becomes part of the display name, so everyone sees it before the
//                 name in chat ("[Enforcer] <Goruk> hi"), death messages, /msg and on Discord. Works with
//                 FTB Essentials nicknames ("[Enforcer] Nick"). Not in the tab list or on nameplates.
//                 Secret factions: never in the display name. Fellow members see it only when
//                 SECRET_PREFIX_FOR_MEMBERS is on (see below); everyone else sees whatever an unregistered
//                 player shows.
//   inviteRank    lowest rank allowed to use /faction invite ('' = nobody can invite into this faction)
//   voice         the tag in front of this faction's messages, its colours, and its title-screen text
//   info          the /faction info description (secret factions: shown to members only)
//   welcome       lines shown when someone joins; %title% and %rank% are filled in
//   inviteText    the invitation the invited player sees; %inviter% is filled in (leave it out to keep
//                 the inviter anonymous)
//   inviteReply   what the inviter is told. It's the same whether the invite went out or not, so it
//                 never gives away which faction the other player is in.
//   leaveText     shown to the player when they leave

(function () {

global.FactionsConfigSource = {
  // Changes every time this file runs, so factions_core.js can tell whether it loaded this time.
  stamp: Date.now() + '-' + Math.random(),

  settings: {
    DEFAULT_FACTION: 'unregistered',   // every player starts here; must be one of the ids below
    INVITE_MINUTES: 5,                 // invitations expire after this long
    ANNOUNCE_DESERTION: true,          // tell everyone online when someone leaves a faction that has desertionText
    REJOIN_COOLDOWN_MINUTES: 0,        // after leaving, wait this long before an invite can reach them (0 = none)
    SHOW_PUBLIC_PREFIX: true,          // public factions' chatPrefix in front of the player's name
    // Secret factions' chatPrefix, shown only to fellow members. OFF by default, because it has to cancel
    // each of their chat messages and send every viewer their own copy. Read FACTIONS.md before turning
    // it on: it can change how those messages reach Discord and how they look in chat.
    SECRET_PREFIX_FOR_MEMBERS: false,
    ADMINS_READ_FACTION_CHAT: false,   // true = ops also see every /faction chat message
    LOG_CHANGES: false,                // true = the server log records "faction change for <uuid>" (no faction names)
  },

  factions: [
    {
      id: 'ministry',
      displayName: "Techno's Crownsworn",
      memberTitle: 'Loyalist',
      color: 'gold',
      secret: false,
      ranks: ['Recruit', 'Loyalist', 'Enforcer', 'Minister'],
      chatPrefix: '[%rank%]',
      inviteRank: 'Enforcer',
      voice: { tag: '[MINISTRY]', tagColor: 'gold', textColor: 'yellow', title: 'MINISTRY', subtitle: 'Your paperwork has been processed.' },
      chatLabel: '[MINISTRY CHANNEL]',
      info: [
        'The government. Glory to Managed Trollocracy.',
        'The Ministry keeps order, files paperwork about the order, and audits the paperwork.',
        'Loyalists enjoy protection, structure and the freedom to agree. Enforcers inspect bases and judge trials.',
      ],
      welcome: [
        'Welcome, %title%. Your paperwork has been processed. Your freedom has been managed.',
        'Your rank: %rank%. Your opinions will be issued shortly.',
        'Speak to fellow Loyalists with /faction chat. All conversations are recorded for quality and loyalty purposes.',
      ],
      inviteText: 'You have been selected for citizenship processing by %inviter%. Refusal will be noted.',
      inviteReply: 'Your request has been filed. The Ministry will process it in due course.',
      leaveText: 'Your resignation has been received. It has been filed under "Disappointments".',
      desertionText: 'NOTICE OF DESERTION: %player% has abandoned their post. Their paperwork has been shredded.',
    },
    {
      id: 'syndicate',
      displayName: "The Blood God's Syndicate",
      memberTitle: 'Operative',
      color: 'dark_red',
      secret: true,
      ranks: ['Sympathizer', 'Operative', 'Cell Leader'],
      chatPrefix: '[%rank%]',
      inviteRank: 'Cell Leader',
      voice: { tag: '[SIGNAL HIJACKED]', tagColor: 'dark_red', textColor: 'red', title: 'SIGNAL HIJACKED', subtitle: 'You were never here.' },
      chatLabel: '[ENCRYPTED]',
      info: [
        'There is no Syndicate. If there were, it would answer to no one.',
        'No kings. No Ministers. No paperwork. The pigs remember who protected them.',
        'Cell Leaders bring in new Operatives. Trust the cell. Trust nobody else.',
      ],
      welcome: [
        'You were never here. Neither were we. Welcome to the Syndicate, %title%.',
        'Your rank: %rank%. Tell no one. Not even the pigs.',
        'Speak to the cell with /faction chat. Everything else is Ministry noise.',
      ],
      inviteText: 'Someone has been watching you. The pigs say you can be trusted. This message will not repeat.',
      inviteReply: 'Your request has been filed.',
      leaveText: 'Connection terminated. We were never here. Neither were you.',
      desertionText: '',   // never announced
    },
    {
      id: 'unregistered',
      displayName: 'Unregistered Citizens',
      memberTitle: 'Citizen',
      color: 'gray',
      secret: false,
      ranks: ['Citizen'],
      chatPrefix: '',
      inviteRank: '',
      voice: { tag: '[MINISTRY]', tagColor: 'gold', textColor: 'gray', title: 'UNREGISTERED', subtitle: 'Your file is incomplete.' },
      chatLabel: '',
      info: [
        'Citizens who have not yet completed their paperwork. The Ministry is patient. Mostly.',
        'Unregistered Citizens may be recruited. Recruitment is voluntary. Volunteering may be mandatory.',
      ],
      welcome: [
        'You are now an Unregistered Citizen. Your file has been marked "pending".',
      ],
      inviteText: '',
      inviteReply: 'Your request has been filed.',
      leaveText: '',
      desertionText: '',
    },
  ],
}

})()
