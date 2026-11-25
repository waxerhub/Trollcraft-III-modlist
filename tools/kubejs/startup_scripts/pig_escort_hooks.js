// Pig Escort Detail: Forge event hooks.
//
// Why this is a startup script: in KubeJS 6, raw Forge events (ForgeEvents.onEvent) can only be listened
// to from startup scripts. The event needs five Forge events KubeJS doesn't expose any other way:
//   - EntityTravelToDimensionEvent  stop anything going through the event portal; the pig entering = Escort win
//   - EntityTeleportEvent           stop ender pearls, chorus fruit, /tp and mods from teleporting the pig
//   - EntityMountEvent              stop the pig being ridden or put in a boat/minecart/any vehicle
//   - MobEffectEvent$Applicable     stop status effects being applied to the pig
//   - PlayerInteractEvent$EntityInteractSpecific   the second kind of right-click some mods use
//   - LivingHurtEvent               scale raider mob damage to the pig by the difficulty multiplier
//
// Each hook only passes the event to global.pigEscort, which server_scripts/events/pig_escort.js defines,
// so all the logic stays reloadable. Each one returns straight away unless an event is running.
// Restart the server after adding or changing this file (/reload doesn't reload startup scripts).

global.pigEscortHooksInstalled = 1

function pigEscortForward(name, event) {
  const h = global.pigEscort
  if (!h || !h.running) return
  try {
    h[name](event)
  } catch (e) {
    console.error('[PigEscort] ' + name + ' hook failed: ' + e)
  }
}

ForgeEvents.onEvent('net.minecraftforge.event.entity.EntityTravelToDimensionEvent', event => pigEscortForward('onTravel', event))
ForgeEvents.onEvent('net.minecraftforge.event.entity.EntityTeleportEvent', event => pigEscortForward('onTeleport', event))
ForgeEvents.onEvent('net.minecraftforge.event.entity.EntityMountEvent', event => pigEscortForward('onMount', event))
ForgeEvents.onEvent('net.minecraftforge.event.entity.living.MobEffectEvent$Applicable', event => pigEscortForward('onEffect', event))
ForgeEvents.onEvent('net.minecraftforge.event.entity.player.PlayerInteractEvent$EntityInteractSpecific', event => pigEscortForward('onInteractSpecific', event))
ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingHurtEvent', event => pigEscortForward('onLivingHurt', event))
