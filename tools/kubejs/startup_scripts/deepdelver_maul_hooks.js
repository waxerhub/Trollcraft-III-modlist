// The Deepdelver's Maul: Forge event hook (see server_scripts/deepdelver_maul.js and tools/kubejs/DEEPDELVER_MAUL.md).
//
// Why this is a startup script: White-hot and the grudge bonus change how much damage a hit does. KubeJS's
// EntityEvents.hurt can't change it, and in KubeJS 6 raw Forge events (ForgeEvents.onEvent) can only be listened to
// from startup scripts.
//   - LivingHurtEvent     the damage before armour: noted when the attacker holds the Maul.
//   - LivingDamageEvent   the damage after armour, protection, resistance and absorption: White-hot lets part of what
//                         those stopped through, and the grudge bonus multiplies it.
//
// The hook only passes the event to global.DeepdelverMaul, which server_scripts/deepdelver_maul.js defines, so the
// logic stays reloadable. Without the server script it does nothing.
// Restart the server after adding or changing this file (/reload doesn't reload startup scripts).

global.deepdelverMaulHooksInstalled = 1

ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingHurtEvent', event => {
  const M = global.DeepdelverMaul
  if (!M || !M.noteHit) return
  try {
    M.noteHit(event.getEntity(), event.getSource(), event.getAmount())
  } catch (e) {
    console.error('[Maul] Hurt hook: ' + e)
  }
})

ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingDamageEvent', event => {
  const M = global.DeepdelverMaul
  if (!M || !M.finalDamage) return
  try {
    let n = M.finalDamage(event.getEntity(), event.getSource(), event.getAmount())
    if (n != null) event.setAmount(n)
  } catch (e) {
    console.error('[Maul] Damage hook: ' + e)
  }
})
