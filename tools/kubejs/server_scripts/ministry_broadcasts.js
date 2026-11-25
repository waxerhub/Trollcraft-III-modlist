// Ministry Broadcasts - random server announcements for Trollcraft III.
// KubeJS 6 (Forge 1.20.1). Put this file in <server>/kubejs/server_scripts/ and run /reload.
//
// How it works:
//  - While at least one player is online, a random broadcast fires every MIN..MAX minutes.
//  - When the server empties, the timer is cancelled. The first player to join starts a fresh timer
//    (nothing fires on join itself).
//  - Messages come out of a shuffle bag: all of them are used once before any repeats.
//  - Each broadcast goes to chat, the action bar, or (rarely) a full-screen title, with a quiet note block sound.
//
// Admin commands (op level 2):
//   /ministry broadcast now     - send one immediately (also restarts the countdown)
//   /ministry broadcast off     - turn broadcasts off (stays off through restarts)
//   /ministry broadcast on      - turn broadcasts back on
//   /ministry broadcast status  - show on/off, players online and time until the next one
//
// Note: KubeJS 6's script engine (Rhino) has no `template strings`, so strings are joined with +.

// ===================== SETTINGS (edit these) =====================

// Random wait between broadcasts, in minutes.
const MIN_INTERVAL_MINUTES = 10
const MAX_INTERVAL_MINUTES = 15

// How often each display style is picked. Whatever is left over goes to chat.
// 0.10 = about 10% full-screen titles, 0.20 = about 20% action bar, so about 70% chat.
const FULLSCREEN_CHANCE = 0.10
const ACTIONBAR_CHANCE = 0.20

// Titles and the action bar don't wrap text, so long messages would run off the screen.
// Messages longer than these limits fall back as described below.
const ACTIONBAR_MAX_CHARS = 60  // longer messages go to chat instead
const SUBTITLE_MAX_CHARS = 45   // longer messages show SUBTITLE_FALLBACK on screen and the full text in chat

// Full-screen title text. "[MINISTRY BROADCAST]" is too wide for the big title font at the default GUI scale.
const TITLE_TEXT = 'MINISTRY'
const SUBTITLE_FALLBACK = 'Official broadcast. Check your chat.'

// Chat / action bar prefix.
const PREFIX = '[MINISTRY BROADCAST]'

// Sound played to every online player (volume 0.0-1.0, pitch 0.5-2.0).
const SOUND = 'minecraft:block.note_block.chime'
const SOUND_VOLUME = 0.4
const SOUND_PITCH = 1.2

// ===================== MESSAGES =====================

const MESSAGES = [
  "The Ministry reminds you: loyalty is free. Disloyalty is very expensive.",
  "Today's forecast: 100% chance of Ministry oversight.",
  "Remember, recruits: the Ministry is always watching. Mostly. Sometimes it blinks.",
  "Pigs are friends. Pork is contraband. Know the difference.",
  "Have you hugged a pig today? The Ministry recommends at least one hug per day.",
  "Snitching is patriotic. Snitching on snitches is doubly patriotic.",
  "Form 66-B processing times are currently 3 to 5 business days. There are no business days.",
  "Reminder: questioning the Ministry is a symptom. Please report to the nearest Enforcer for treatment.",
  "The Ministry does not make mistakes. The Ministry makes adjustments.",
  "Your base looks lovely. The Ministry has the coordinates.",
  "Freedom is a privilege. Privileges are revocable.",
  "A troll who obeys is a troll who lives. Probably.",
  "The Ministry would like to thank you for your cooperation, which was never optional.",
  "Did you lock your chests? The Ministry is not implying anything.",
  "Unsanctioned fun has been detected in your area. Please stop.",
  "All complaints may be submitted via Form 404: Complaint Not Found.",
  "Technoblade never dies. Neither does the Ministry.",
  "The Nether is closed for your safety. Your safety is closed for the Ministry's convenience.",
  "Piglins are Honorary Diplomats. Treat them with respect and gold.",
  "Hoglins are pigs too. Aggressive pigs. Still pigs.",
  "The Ministry has reviewed your inventory. The Ministry is disappointed.",
  "Paperwork is the backbone of freedom.",
  "Remember to file your forms in triplicate. Retain no copies.",
  "Taxes are not theft. Taxes are mandatory gifts.",
  "The Ministry loves you. The Ministry also has your home coordinates.",
  "Sleeping is permitted. Dreaming of rebellion is not.",
  "Enforcers are your friends. Do not make eye contact with your friends.",
  "Today's Ministry fun fact: you are being monitored.",
  "Unauthorized mods are contraband. So is your sense of humor, pending review.",
  "Allocate 8 GB of RAM. The Ministry has done the math so you don't have to.",
  "Loading screens are a test of loyalty. You are doing great.",
  "The Ministry is not responsible for lost items, lost bases, or lost friendships.",
  "Friendly Fire is in the name for a reason.",
  "A reminder that bribing an Enforcer is illegal. Voluntary Gratitude Offerings are welcome.",
  "Cake is an acceptable Voluntary Gratitude Offering. Pork pie is not.",
  "Creepers are not affiliated with the Ministry. The Ministry denies everything.",
  "If you see something, say something. If you see nothing, say something anyway.",
  "The Ministry has detected an unusual amount of happiness. Investigation underway.",
  "Have you considered running? Have you considered running harder?",
  "The Ministry's authority is not unlimited. It is just not well defined.",
  "Village trading is permitted. Village fraud is encouraged, but only against villagers.",
  "Every block you place is a block the Ministry approves of. Until it doesn't.",
  "Strategic Sites must pay their Security Tax. The turrets are watching.",
  "Ministry-Issued Defenses will not target Enforcers. They may target you.",
  "Neglected defenses may forget whose side they're on.",
  "Your squad is only as strong as its weakest snitch.",
  "The Ministry would like to remind you that diamonds are a renewable resource. Your life is not.",
  "Do not feed the Enforcers. They will follow you home.",
  "Lava is hot. The Ministry is hotter.",
  "Mining at night is permitted. Mining the Ministry is not.",
  "The Ministry has approved today's weather. Complaints about rain will be ignored.",
  "Phantoms are a reminder to sleep. The Ministry is a reminder of everything else.",
  "All tribunals are fair, impartial, and already decided.",
  "Guilty until proven guiltier.",
  "The Ministry thanks you for reading this broadcast. Your attention has been logged.",
  "Reminder: the Ministry Listening Post hears every word you type.",
  "Typing in chat is a privilege. Typing nonsense is a crime against literacy.",
  "Glory to Managed Trollocracy.",
  "Democracy was too unmanaged. Trollocracy fixes that.",
  "Managed Democracy is a foreign ideology. Please report all eagles.",
  "Eagles are under surveillance for suspected swine-hunting activities.",
  "Birds are, historically, extremely angry. Stay vigilant.",
  "Slingshots are banned. The Ministry will not elaborate.",
  "A clean inventory is a loyal inventory.",
  "Ender chests are not a hiding place. They are an Obstruction of Trollocracy.",
  "Voluntary inspections are mandatory.",
  "Your opinion matters to the Ministry. Please keep it to yourself.",
  "The Ministry is hiring Enforcers. Requirements: none. Compensation: power.",
  "Want to serve Trollocracy? You already are. You have no choice.",
  "Wolves may be tamed. Recruits may be tamed. The Ministry is working on it.",
  "Cats are exempt from all laws. The Ministry fears cats.",
  "Iron golems are neutral parties. Do not test their neutrality.",
  "The Ministry reminds you that falling is the leading cause of fall damage.",
  "Water buckets save lives. The Ministry saves nothing.",
  "Torches are encouraged. Darkness is where dissent grows.",
  "Please wash your hands. The Ministry is not sure how, but please.",
  "The Ministry does not eat porkchops. The Ministry does not answer further questions about this.",
  "All surrendered porkchops are disposed of respectfully. Do not ask how.",
  "The Sanctity of Swine Act is non-negotiable. Pigs outrank you.",
  "Pigs have always outranked you.",
  "Making prolonged eye contact with a pig in a threatening manner is a crime.",
  "Riding a pig is permitted only with the pig's written consent.",
  "Carrots on sticks are considered bribery. Pigs accept bribes. You may not.",
  "Bacon-adjacent thoughts are being monitored.",
  "The Ministry has located your secret base. It was not very secret.",
  "Hidden bases are a myth. The Ministry has a map.",
  "Every portal is a door. Every door is a Ministry door.",
  "Unsanctioned portals will be disabled. Sanctioned portals will be watched.",
  "Bastion raiding is an international incident. Please do not cause international incidents.",
  "The Ministry encourages trade. The Ministry taxes trade. These are related.",
  "Ministry Merits can be earned through loyalty. Demerits can be earned through everything else.",
  "Your Merit balance is a reflection of your character. Some of you need character development.",
  "The Ministry Lottery: you can't win if you don't pay. You probably can't win if you do.",
  "Every Ministry event is optional. Missing one will be noted.",
  "Participation is its own reward. The Ministry has no other rewards for you.",
  "A wooden shovel named Thank You For Your Service is still a shovel. Be grateful.",
  "The Ministry has never lost a trial. The Ministry has never been on trial.",
  "Appeals are welcome. Successful appeals are not.",
  "The Ministry respects your right to remain silent. Silence will be interpreted as guilt.",
  "Witnesses are encouraged to come forward. Witnesses who don't will be found.",
  "Your testimony is valuable. Its truthfulness is a matter for the court.",
  "The truth is whatever the testimony says it is.",
  "Remember: a confession saves time. The Ministry values time.",
  "The Ministry has no enemies. Only future defendants.",
  "Every recruit is equal. Some are just more under investigation.",
  "Trolling equality is a right. Being trolled is a responsibility.",
  "Recruits with jobs deserve to be trolled too. Trolling Equality for all.",
  "The Ministry creates problems so it can provide solutions. This is called governance.",
  "Have a grievance? File a form. Have a form? File a grievance about the form.",
  "The Ministry is here to help. The Ministry is always here.",
  "Please do not tap on the glass. The Ministry is sleeping.",
  "The Ministry never sleeps. That was a test.",
  "Congratulations! You have been selected for a random audit. Just kidding. Unless.",
  "Random audits are random. The Ministry chooses them randomly. On purpose.",
  "Please keep all limbs inside your base at all times.",
  "Toe counts are subject to verification.",
  "Suspected toe irregularities should be reported via Form 10-T.",
  "Hopping is a legal form of transportation for recruits with confiscated feet.",
  "The Ministry is not responsible for confiscated feet.",
  "Your feet will be returned after a full toe audit. Estimated completion: 2031.",
  "Mobs spawn in darkness. So does treason. Light your bases.",
  "Every creeper explosion is investigated as a possible act of sabotage.",
  "The Ministry suspects the creepers. The creepers suspect the Ministry.",
  "Endermen are not spies. Probably. Do not look at them just in case.",
  "The Ministry has ruled that Zoglins are still under review. Run.",
  "Zombified Piglins retain full citizenship. Undeath is not a crime.",
  "Skeletons are bad at archery. Do not be like skeletons.",
  "Villagers are citizens with limited rights and unlimited prices.",
  "The Ministry did not raise emerald prices. The villagers did. The Ministry approves.",
  "Wandering traders are unlicensed vendors. Their llamas are under surveillance.",
  "Llamas spit. The Ministry also spits, metaphorically, on disloyalty.",
  "Bees are protected workers of the agricultural sector. Do not anger the hive.",
  "Honey is a renewable resource. Ministry patience is not.",
  "Composters are recycling centers. Recycling is patriotic. Composting evidence is not.",
  "Farming is patriotic. Over-farming lags the server. Moderation is also patriotic.",
  "Large mob farms are a burden on the server. The Ministry will find them.",
  "Excessive item entities have been detected. Clean up after yourselves.",
  "Lag is not the Ministry's fault. Lag is your fault. The Ministry has a profiler.",
  "Server TPS is a measure of loyalty. Please be more loyal.",
  "Chunk loaders are a privilege. The Ministry counts every one.",
  "Exploring new chunks is patriotic. Lagging the server is treason. Balance is key.",
  "Elytra flight through unexplored terrain is a crime against TPS.",
  "The world border is for your protection. The Ministry decides how far you may dream.",
  "The Ministry has pre-generated your destiny. Please do not wander off it.",
  "Spawn is neutral territory. Neutral territory is Ministry territory.",
  "Public structures may be claimed. Paperwork may be required. Paperwork is always required.",
  "Form 77-C is the only path to property ownership. Read it carefully. Read it again.",
  "Landlords pay taxes. The Ministry is the landlord. The Ministry pays nothing.",
  "Squatting on Ministry land is permitted, for a small fee.",
  "The Ministry reserves the right to adjust taxes based on vibes.",
  "Today's vibes: taxable.",
  "Tax Day is every day if you believe hard enough.",
  "Unpaid taxes accrue interest. Interest accrues disappointment.",
  "The Ministry will collect from whoever is standing closest. Stand far away.",
  "Squads are permitted. Conspiracies are not. The difference is paperwork.",
  "All squads must register with the Ministry. Unregistered squads are gangs.",
  "Gangs will be dealt with. Squads will be taxed.",
  "Betrayal is a valid strategy. Getting caught betraying is not.",
  "Fake betrayals are still betrayals. The Ministry was not fooled. Probably.",
  "Your squad loves you. Your squad is also planning something.",
  "Trust no one. Except the Ministry. Especially not the Ministry.",
  "Friendships are temporary. Ministry records are permanent.",
  "The Ministry Archives remember everything. Even the things you forgot.",
  "Your permanent record is looking colorful today.",
  "The Ministry has added a note to your file. You may not read it.",
  "Please stop trying to read your file.",
  "Classified information is classified for a reason. The reason is classified.",
  "The Ministry neither confirms nor denies the existence of this broadcast.",
  "This broadcast has been approved by the Ministry of Mostly Truth.",
  "The Ministry of Mostly Truth reminds you that most of this is true.",
  "The Ministry of Swinemanity is investigating all reports of pig mistreatment.",
  "The Ministry of Unanimity reminds you that we all agree. Don't we?",
  "The Ministry of Offense is planning something. The Ministry of Defense is concerned.",
  "Bureaucracy benefits few and inconveniences all. You're welcome.",
  "Roadblocks build character. The Ministry has built you many roadblocks.",
  "Outlawing unreasonably is the Ministry's specialty.",
  "The Ministry has outlawed nothing today. Yet.",
  "New laws may be ratified at any time. Ignorance of the law is the Ministry's favorite excuse.",
  "Read the Sacred Articles. Read and regret, agree and regret, disagree and die.",
  "The Sacred Articles are updated regularly. Your agreement is updated automatically.",
  "By reading this broadcast, you have agreed to it. This loop is binding.",
  "Opting out is not an option. Opting in is assumed.",
  "The terms and conditions of Trollocracy are 4,000 pages long. You have accepted them.",
  "Recruits are reminded that whining is not a form of protest. It is just whining.",
  "Protests are permitted in the designated protest zone. The zone is in the void.",
  "The void is not a punishment. It is a destination.",
  "The Ministry does not exile. The Ministry relocates permanently.",
  "Persona Non Trolla status is a privilege you do not want.",
  "Associating with traitors is contagious. Wash your hands of them.",
  "Redemption is possible. Redemption is also very funny to watch.",
  "The best revenge is a proportional troll. The Ministry prefers disproportional.",
  "Every troll is a story. The Ministry is the narrator.",
  "Be creative. Be devastating. Be stupidly hilarious.",
  "Nothing is off the table if stated well and obviously, stupidly hilarious.",
  "The Ministry rewards creative trolling. The Ministry punishes boring trolling.",
  "Boring trolls will be sent to re-education. Re-education is also boring.",
  "Re-education camps are now called Fun Improvement Centers.",
  "Attendance at Fun Improvement Centers is voluntary. Escape is not.",
  "The Purge is a celebration of community. Please celebrate responsibly.",
  "During the Purge, all crime is legal. Paperwork is still required.",
  "Purge preparations are encouraged. Purge paranoia is expected.",
  "Remember the Purge? The Ministry remembers. The Ministry is planning another.",
  "The next event is coming soon. Or later. The Ministry decides.",
  "Supply drops are a gift from the Ministry. Fight over them like civilized people.",
  "Bounties are a public service. Being the bounty is also a public service.",
  "If you have a bounty on your head, the Ministry suggests running. Harder.",
  "Hot potatoes are dangerous. Pass them responsibly.",
  "The Ministry has hidden a surprise somewhere in the world. It might be good.",
  "That noise you heard was nothing. Please continue as normal.",
  "That explosion you heard was a Wireless Trollocracy Deliverance System. Please continue as normal.",
  "Wireless Trollocracy Deliverance Systems are installed for your comfort and convenience.",
  "Do not dig straight down. The Ministry has seen what happens.",
  "Do not dig straight up either. The Ministry has also seen that.",
  "Gravel is a trap. Sand is a trap. Everything is a trap.",
  "The Ministry recommends a helmet. The Ministry recommends many helmets.",
  "Armor is self-expression. Diamond armor is aggressive self-expression.",
  "Netherite is a privilege of the Nether. The Nether is closed.",
  "The End is near. The End Portal is claimed. Please file a Form 77-C.",
  "The Ender Dragon is not a citizen. It is an invasive species.",
  "Elytra must be registered with the Ministry Department of Aviation.",
  "Fireworks are for celebrations and flight only. Fireworks in crossbows are for Ministry events.",
  "Tridents are permitted. Throwing them at Enforcers is not.",
  "Fishing is relaxing. Relaxing is suspicious.",
  "The Ministry has noticed you AFK-fishing. The Ministry has questions.",
  "AFK recruits are presumed loyal. They are also presumed lootable.",
  "Logging out does not exempt you from Ministry oversight.",
  "Logging in is an act of loyalty. Thank you for your service.",
  "Your login has been recorded. Your logout will also be recorded. Plan accordingly.",
  "The Ministry wishes you a pleasant session. Pleasantness not guaranteed.",
  "Please enjoy your mandatory fun.",
  "Fun is mandatory. Fun levels are monitored.",
  "Insufficient fun has been detected. Please have more fun immediately.",
  "Laughing at Ministry broadcasts is encouraged. Laughing at the Ministry is not.",
  "The Ministry has a sense of humor. It was confiscated from a recruit.",
  "Memes are a form of propaganda. The Ministry approves of the funny ones.",
  "Respect the Skull Admiral of Modding. He controls the mod list.",
  "Crashes are the personal responsibility of the Skull Admiral of Modding.",
  "If your game crashes, it was sabotage. Please submit your log file.",
  "\"It broke\" is not a log file.",
  "The Ministry Listening Post is always listening. Say something nice.",
  "A word from the Ministry: you're doing great. This message is not sincere.",
  "The Ministry believes in you. The Ministry also believes you are guilty of something.",
  "Every day is a new opportunity to disappoint the Ministry. Seize it.",
  "Tomorrow is another day. The Ministry will still be here.",
  "Lost? Ask an Enforcer for directions. They will charge you.",
  "Need help? Admin assistance is available. Admin patience is limited.",
  "The Ministry will respond to your request shortly. Shortly is a Ministry unit of time.",
  "Remember: you enlisted voluntarily. The Ministry has the paperwork to prove it.",
  "Technoblade is watching. Make him proud. Spare the pigs.",
  "This has been a broadcast from the Ministry of Trolling. Glory to Managed Trollocracy."
]

// ===================== STATE =====================
// `global` survives /reload, so the shuffle bag isn't reset by every reload.
// The on/off switch is saved in the world (server.persistentData) so it survives restarts too.

const OFF_KEY = 'ministry_broadcasts_off'

if (!global.ministry) {
  global.ministry = { timerId: 0, timerActive: false, nextFireTick: 0, bag: [], bagSize: 0, lastIndex: -1 }
}
const state = global.ministry

// Every scheduled timer remembers the timerId it was started with. Bumping timerId makes any older
// timer do nothing when it fires. This cancels timers left over from before a /reload.
state.timerId++
state.timerActive = false

// Chance for a short message (one that fits the action bar) to use it, worked out so that roughly
// ACTIONBAR_CHANCE of all broadcasts end up on the action bar.
const SHORT_FRACTION = MESSAGES.filter(m => m.length <= ACTIONBAR_MAX_CHARS).length / MESSAGES.length
const ACTIONBAR_CHANCE_SHORT = SHORT_FRACTION > 0
  ? Math.min(1, ACTIONBAR_CHANCE / (SHORT_FRACTION * (1 - FULLSCREEN_CHANCE)))
  : 0

// If the message list was edited, start a new shuffle bag.
if (state.bagSize != MESSAGES.length) {
  state.bag = []
  state.bagSize = MESSAGES.length
  state.lastIndex = -1
}

// ===================== HELPERS =====================

function isEnabled(server) {
  return !server.persistentData.getBoolean(OFF_KEY)
}

function playersOnline(server) {
  return server.playerCount > 0
}

function run(server, command) {
  server.runCommandSilent(command)
}

// Start (or restart) the countdown to the next broadcast.
function startTimer(server) {
  state.timerId++
  const myId = state.timerId
  const minutes = MIN_INTERVAL_MINUTES + Math.random() * (MAX_INTERVAL_MINUTES - MIN_INTERVAL_MINUTES)
  const ticks = Math.round(minutes * 60 * 20) // 20 ticks per second
  state.timerActive = true
  state.nextFireTick = server.tickCount + ticks

  server.scheduleInTicks(ticks, () => {
    if (myId != state.timerId) return // this timer was cancelled or replaced
    state.timerActive = false
    const s = Utils.server
    if (!s || !playersOnline(s) || !isEnabled(s)) return // stay paused until someone joins / it's turned on
    sendBroadcast(s)
    startTimer(s)
  })
}

// Cancel the countdown.
function stopTimer() {
  state.timerId++
  state.timerActive = false
}

// Take the next message out of the shuffle bag, refilling and reshuffling it when it runs out.
function nextMessage() {
  const bag = state.bag
  if (bag.length == 0) {
    for (let i = 0; i < MESSAGES.length; i++) bag.push(i)
    // Fisher-Yates shuffle
    for (let i = bag.length - 1; i > 0; i--) {
      let j = Math.floor(Math.random() * (i + 1))
      let t = bag[i]; bag[i] = bag[j]; bag[j] = t
    }
    // Messages are taken from the end. Don't start the new round with the one that just played.
    if (bag.length > 1 && bag[bag.length - 1] == state.lastIndex) {
      let t = bag[0]; bag[0] = bag[bag.length - 1]; bag[bag.length - 1] = t
    }
  }
  const index = bag.pop()
  state.lastIndex = index
  return MESSAGES[index]
}

// Send one broadcast to everyone online.
function sendBroadcast(server) {
  const message = nextMessage()

  // Pick how to show it. Only short messages can use the action bar, so short ones get it more
  // often (ACTIONBAR_CHANCE_SHORT) to keep the overall action bar share near ACTIONBAR_CHANCE.
  let mode = 'chat'
  if (Math.random() < FULLSCREEN_CHANCE) mode = 'fullscreen'
  else if (message.length <= ACTIONBAR_MAX_CHARS && Math.random() < ACTIONBAR_CHANCE_SHORT) mode = 'actionbar'

  // Bold gold prefix + yellow message, as raw JSON text for /tellraw and /title.
  const line = JSON.stringify(['',
    { text: PREFIX, color: 'gold', bold: true },
    { text: ' ' + message, color: 'yellow' }])

  if (mode == 'fullscreen') {
    let fits = message.length <= SUBTITLE_MAX_CHARS
    run(server, 'title @a times 10 100 20') // fade in, stay, fade out (ticks)
    run(server, 'title @a subtitle ' + JSON.stringify({ text: fits ? message : SUBTITLE_FALLBACK, color: 'yellow' }))
    run(server, 'title @a title ' + JSON.stringify({ text: TITLE_TEXT, color: 'gold', bold: true }))
    if (!fits) run(server, 'tellraw @a ' + line)
  } else if (mode == 'actionbar') {
    run(server, 'title @a actionbar ' + line)
  } else {
    run(server, 'tellraw @a ' + line)
  }

  run(server, 'execute as @a at @s run playsound ' + SOUND + ' master @s ~ ~ ~ ' + SOUND_VOLUME + ' ' + SOUND_PITCH)
  console.info('[Ministry] ' + mode + ': ' + message)
}

// ===================== EVENTS =====================

// First player in starts a fresh countdown. Nothing is sent on join.
PlayerEvents.loggedIn(event => {
  const server = event.server
  if (!state.timerActive && isEnabled(server)) startTimer(server)
})

// The leaving player still counts as online during this event, so check one tick later.
PlayerEvents.loggedOut(event => {
  const server = event.server
  server.scheduleInTicks(1, () => {
    if (!playersOnline(server)) stopTimer()
  })
})

// After a /reload with people online, start a new countdown (the old one was cancelled above).
// On a normal server start there's no server yet and nobody online, so this does nothing.
if (Utils.server && playersOnline(Utils.server) && isEnabled(Utils.server)) startTimer(Utils.server)

// ===================== COMMANDS =====================

ServerEvents.commandRegistry(event => {
  const Commands = event.commands

  const reply = (ctx, text) => ctx.source.sendSystemMessage(Text.gold(text))

  event.register(
    Commands.literal('ministry')
      .requires(source => source.hasPermission(2))
      .then(Commands.literal('broadcast')
        .then(Commands.literal('now').executes(ctx => {
          const server = ctx.source.server
          sendBroadcast(server)
          // Restart the countdown so the next automatic one isn't right after this.
          if (isEnabled(server) && playersOnline(server)) startTimer(server)
          reply(ctx, 'Ministry broadcast sent.')
          return 1
        }))
        .then(Commands.literal('off').executes(ctx => {
          ctx.source.server.persistentData.putBoolean(OFF_KEY, true)
          stopTimer()
          reply(ctx, 'Ministry broadcasts are OFF.')
          return 1
        }))
        .then(Commands.literal('on').executes(ctx => {
          const server = ctx.source.server
          server.persistentData.putBoolean(OFF_KEY, false)
          if (playersOnline(server) && !state.timerActive) startTimer(server)
          reply(ctx, 'Ministry broadcasts are ON.')
          return 1
        }))
        .then(Commands.literal('status').executes(ctx => {
          const server = ctx.source.server
          let next = 'paused (nobody online or broadcasts off)'
          if (state.timerActive) {
            let secs = Math.max(0, Math.round((state.nextFireTick - server.tickCount) / 20))
            next = Math.floor(secs / 60) + 'm ' + (secs % 60) + 's'
          }
          reply(ctx, 'Broadcasts: ' + (isEnabled(server) ? 'ON' : 'OFF') +
            ' | Players online: ' + server.playerCount +
            ' | Next: ' + next +
            ' | Left in this round: ' + state.bag.length + '/' + MESSAGES.length)
          return 1
        }))
      )
  )
})
