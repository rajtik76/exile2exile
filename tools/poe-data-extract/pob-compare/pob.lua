-- Reads a local Path of Building (PathOfBuilding-PoE2) checkout and prints what
-- the compare script checks our extraction against, as JSON on stdout:
--
--   luajit pob.lua tree    the passive tree PoB ships (TreeData/<latest>/tree.lua)
--   luajit pob.lua runes   the runes and soul cores (Data/ModRunes.lua), plus the
--                          stat-category to slot map of PoB's soul-core export
--   luajit pob.lua gems    the gem list (Data/Gems.lua) plus every skill's tooltip
--                          lines per stat set and level, and its quality lines
--
-- Run it from the checkout's `src/` directory (compare.mjs does). Nothing of PoB
-- is copied here: its own modules are loaded from the checkout and called - the
-- stat describer, calcLib.buildSkillInstanceStats and the helpers they use - so
-- the gem lines are rendered exactly the way PoB's gem tooltip renders them
-- (Classes/GemTooltip.lua). Its native modules (curl, xml, ...) are not needed
-- for this and are stubbed out.

local command = arg[1]

-- --- JSON -------------------------------------------------------------------

local function quote(text)
  return '"' .. text:gsub('[%c"\\]', function(c)
    local escapes = { ['"'] = '\\"', ['\\'] = '\\\\', ['\n'] = '\\n', ['\r'] = '\\r', ['\t'] = '\\t' }
    return escapes[c] or string.format('\\u%04x', c:byte())
  end) .. '"'
end

local function encode(value, seen)
  seen = seen or {}
  local kind = type(value)
  if kind == 'nil' then return 'null'
  elseif kind == 'boolean' then return tostring(value)
  elseif kind == 'number' then
    if value ~= value or value == math.huge or value == -math.huge then return 'null' end
    if value == math.floor(value) and math.abs(value) < 1e15 then return string.format('%d', value) end
    return string.format('%.17g', value)
  elseif kind == 'string' then return quote(value)
  elseif kind ~= 'table' or seen[value] then return 'null'
  end
  seen[value] = true
  local count, highest, isArray = 0, 0, true
  for key in pairs(value) do
    count = count + 1
    if type(key) ~= 'number' or key < 1 or key ~= math.floor(key) then isArray = false
    elseif key > highest then highest = key end
  end
  local parts = {}
  if isArray and highest == count then
    for i = 1, count do parts[i] = encode(value[i], seen) end
    seen[value] = nil
    return '[' .. table.concat(parts, ',') .. ']'
  end
  for key, item in pairs(value) do
    if type(item) ~= 'function' then parts[#parts + 1] = quote(tostring(key)) .. ':' .. encode(item, seen) end
  end
  seen[value] = nil
  return '{' .. table.concat(parts, ',') .. '}'
end

-- --- PoB environment ----------------------------------------------------------

for _, name in ipairs({ 'lcurl.safe', 'xml', 'base64', 'sha1', 'lua-utf8', 'lua-profiler' }) do
  package.preload[name] = function() return {} end
end
function ConPrintf() end
launch = {}

function LoadModule(name, ...)
  return assert(loadfile(name .. '.lua'))(...)
end

dofile('Modules/Common.lua')
dofile('GameVersions.lua')
LoadModule('Data/Global')
data = { gameConstants = LoadModule('Data/Misc').gameConstants }
dofile('Modules/CalcTools.lua')

-- Skill data files register mods through these; the comparison never reads mods.
local function noMod() return {} end

local function loadSkills()
  local skills = {}
  for _, name in ipairs({ 'act_str', 'act_dex', 'act_int', 'other', 'minion', 'spectre', 'sup_str', 'sup_dex', 'sup_int' }) do
    local fill = LoadModule('Data/Skills/' .. name, skills, noMod, noMod, noMod)
    if type(fill) == 'function' then fill(skills, noMod, noMod, noMod) end
  end
  return skills
end

-- --- commands -----------------------------------------------------------------

if command == 'tree' then
  io.write(encode(LoadModule('TreeData/' .. latestTreeVersion .. '/tree')))
elseif command == 'runes' then
  -- PoB keys a rune's lines by slot type; its soul-core export maps each GGG stat
  -- category to those slot types with `classMap`. Read that table from the export
  -- script itself (the rest of the script needs PoB's GGPK reader).
  local script = assert(io.open('Export/Scripts/soulcores.lua')):read('*a')
  local classMap = assert(loadstring('return ' .. script:match('classMap = (%b{})')))()
  io.write(encode({ runes = LoadModule('Data/ModRunes'), classMap = classMap }))
elseif command == 'gems' then
  local describeStats = LoadModule('Modules/StatDescriber')
  local skills = {}
  for id, grantedEffect in pairs(loadSkills()) do
    local maxLevel = 0
    for level in pairs(grantedEffect.levels or {}) do
      if type(level) == 'number' and level > maxLevel then maxLevel = level end
    end
    local sets = {}
    for index, statSet in ipairs(grantedEffect.statSets or {}) do
      local levels = {}
      for level = 1, maxLevel do
        local stats = calcLib.buildSkillInstanceStats({ level = level, quality = 0 }, grantedEffect, statSet, false)
        local ok, lines = pcall(describeStats, stats, statSet.statDescriptionScope)
        levels[level] = ok and lines or { 'ERROR: ' .. tostring(lines) }
      end
      sets[index] = { label = statSet.label, scope = statSet.statDescriptionScope, levels = levels }
    end
    -- The quality bonus at 20%, one stat at a time, as the gem tooltip lists it.
    local quality = {}
    for _, stat in ipairs(grantedEffect.qualityStats or {}) do
      local statSet = grantedEffect.statSets[((stat[3] or {})[1] or 0) + 1] or grantedEffect.statSets[1]
      if statSet then
        local ok, lines = pcall(describeStats, { [stat[1]] = 20 * stat[2] }, statSet.statDescriptionScope, true)
        for _, line in ipairs(ok and lines or { 'ERROR: ' .. tostring(lines) }) do quality[#quality + 1] = line end
      end
    end
    skills[id] = { name = grantedEffect.name, sets = sets, quality = quality, castTime = grantedEffect.castTime, levels = grantedEffect.levels }
  end
  io.write(encode({ gems = LoadModule('Data/Gems'), skills = skills }))
else
  io.stderr:write('usage: luajit pob.lua tree|runes|gems\n')
  os.exit(1)
end
