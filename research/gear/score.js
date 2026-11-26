// Scores the gear rows in the .tsv files beside this script (research/gear/) and writes scores.txt. Armour: a full set's damage taken from
// hits of 10, 20 and 40, by Minecraft 1.20.1's own formula (CombatRules.getDamageAfterAbsorb, read from the server
// jar): damage x (1 - clamp(armour - damage / (2 + toughness / 4), armour x 0.2, 20) / 25). Armour is capped at 30
// and toughness at 20 (the attributes' limits). Weapons: damage a hit, and a second at the shown attack speed.
'use strict'
const fs = require('fs'), path = require('path')
const dir = __dirname
const rows = []
fs.readdirSync(dir).filter(f => f.endsWith('.tsv')).forEach(f => {
  const lines = fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/).filter(l => l.trim())
  const head = lines[0].split('\t')
  lines.slice(1).forEach(l => {
    const c = l.split('\t'), r = { file: f }
    head.forEach((h, i) => { r[h] = (c[i] || '').trim() })
    rows.push(r)
  })
})
const num = v => { const m = String(v || '').match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : NaN }
function taken(dmg, armour, tough) {
  const a = Math.min(armour, 30), t = Math.min(tough, 20)
  const f = 2 + t / 4
  const f1 = Math.max(a * 0.2, Math.min(a - dmg / f, 20))
  return dmg * (1 - f1 / 25)
}
// Group armour into sets by the id without its piece name.
const PIECE = /_(helmet|chestplate|leggings|boots|cap|tunic|pants|hood|robes|jacket|crown|mask|hat)$/
const sets = {}
rows.filter(r => r.kind == 'armor' && ['head', 'chest', 'legs', 'feet'].includes(r.slot)).forEach(r => {
  const key = r.item.replace(PIECE, '')
  const s = sets[key] = sets[key] || { key, tier: 0, armour: 0, tough: 0, kb: 0, pieces: 0, abilities: [] }
  s.tier = Math.max(s.tier, num(r.tier) || 0)
  s.armour += num(r.armor) || 0
  s.tough += num(r.toughness) || 0
  s.kb += num(r.knockback_res) || 0
  s.pieces++
  if (r.ability) s.abilities.push(r.ability)
})
const out = []
out.push('# Armour sets (full set; damage taken from a hit of 10 / 20 / 40)')
out.push('tier\tset\tpieces\tarmour\ttoughness\tknockback\t10\t20\t40')
Object.values(sets).sort((a, b) => a.tier - b.tier || taken(20, b.armour, b.tough) - taken(20, a.armour, a.tough)).forEach(s => {
  out.push([s.tier, s.key, s.pieces, s.armour, s.tough, s.kb.toFixed(2), taken(10, s.armour, s.tough).toFixed(2),
    taken(20, s.armour, s.tough).toFixed(2), taken(40, s.armour, s.tough).toFixed(2)].join('\t'))
})
out.push('')
out.push('# Weapons (damage a hit; a second at the shown speed)')
out.push('tier\titem\tdamage\tspeed\tper_second\tability')
rows.filter(r => (r.kind == 'weapon' || /sword|axe|blade|saber|cleaver|hammer|spear|lance|mace|dagger|katana|rapier|scythe|paxel/.test(r.item)) && !isNaN(num(r.attack_damage)))
  .sort((a, b) => (num(a.tier) || 0) - (num(b.tier) || 0) || num(b.attack_damage) - num(a.attack_damage))
  .forEach(r => {
    const d = num(r.attack_damage), sp = num(r.attack_speed)
    out.push([num(r.tier) || 0, r.item, d, isNaN(sp) ? '' : sp, isNaN(sp) ? '' : (d * sp).toFixed(1), (r.ability || '').slice(0, 90)].join('\t'))
  })
fs.writeFileSync(path.join(dir, 'scores.txt'), out.join('\n') + '\n')
console.log('rows ' + rows.length + ', sets ' + Object.keys(sets).length + ' -> scores.txt')
