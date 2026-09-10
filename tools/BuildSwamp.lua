--!strict
-- Builds a swamp inside a marker part. Studio only.
--
-- 1. Insert a Part, name it "SwampRegion", and scale it in top view until it covers the
--    area you want swamped. Its bottom face sets the water surface, so rest it on the
--    ground. Wider than tall is fine; the swamp takes an irregular blob inside it, not
--    the whole rectangle.
-- 2. Paste this file into the Command Bar (View > Command Bar) and press Enter, or drop
--    it in as a Script and use Run Script.
--
-- Rerunning rebuilds from scratch. Trees that were in the way are moved, not deleted,
-- into Workspace.SwampRemovedTrees so you can drag them back if the blob ate too much.
-- Everything built lives under Workspace.Swamp so one Delete clears it.

local CollectionService = game:GetService("CollectionService")
local Workspace = game:GetService("Workspace")

local CONFIG = {
	markerName = "SwampRegion",
	-- Models whose name contains this (case-insensitive) get cleared out of the blob.
	treeNamePattern = "tree",
	-- Set false if the ground is built from parts instead of Terrain. Water then becomes
	-- a translucent part instead of terrain water.
	useTerrain = true,
	waterDepth = 4,
	shoreWidth = 7,
	deadTrees = 9,
	lilyPads = 26,
	reeds = 40,
	seed = 7,
}

local WATER_COLOR = Color3.fromRGB(58, 84, 62)
local MUD_COLOR = Color3.fromRGB(78, 62, 44)
local DEAD_WOOD = Color3.fromRGB(96, 72, 54)
local LIVE_WOOD = Color3.fromRGB(88, 66, 46)
local MOSS = Color3.fromRGB(110, 132, 70)
local LEAF_SHADES = {
	Color3.fromRGB(96, 158, 78),
	Color3.fromRGB(116, 178, 88),
	Color3.fromRGB(80, 138, 70),
	Color3.fromRGB(138, 196, 96),
}

local rng = Random.new(CONFIG.seed)

-- Marker and blob ---------------------------------------------------------------

local marker = Workspace:FindFirstChild(CONFIG.markerName)
assert(
	marker and marker:IsA("BasePart"),
	`Put a Part named {CONFIG.markerName} over the swamp area first`
)

local center = marker.Position
local halfX = marker.Size.X / 2
local halfZ = marker.Size.Z / 2
local waterY = center.Y - marker.Size.Y / 2

-- Irregular outline: a ring of noise around an ellipse, so nothing reads as a box.
-- Returns 0..1 how far inside the blob a point is (1 at the middle, 0 at the edge),
-- or a negative number outside.
local function inside(x: number, z: number): number
	local dx = (x - center.X) / halfX
	local dz = (z - center.Z) / halfZ
	local dist = math.sqrt(dx * dx + dz * dz)
	local angle = math.atan2(dz, dx)
	local wobble = math.noise(math.cos(angle) * 1.7 + CONFIG.seed, math.sin(angle) * 1.7, 0.5)
	local edge = 0.72 + wobble * 0.5
	return 1 - dist / edge
end

local function randomPointInside(minDepth: number): Vector3
	for _ = 1, 400 do
		local x = center.X + rng:NextNumber(-halfX, halfX)
		local z = center.Z + rng:NextNumber(-halfZ, halfZ)
		if inside(x, z) >= minDepth then
			return Vector3.new(x, waterY, z)
		end
	end
	return Vector3.new(center.X, waterY, center.Z)
end

-- Reset ---------------------------------------------------------------------------

local old = Workspace:FindFirstChild("Swamp")
if old then
	old:Destroy()
end

local root = Instance.new("Folder")
root.Name = "Swamp"
root.Parent = Workspace

local removed = Workspace:FindFirstChild("SwampRemovedTrees") or Instance.new("Folder")
removed.Name = "SwampRemovedTrees"
removed.Parent = Workspace

-- Clear trees that stand in the blob.
local pattern = string.lower(CONFIG.treeNamePattern)
for _, child in Workspace:GetChildren() do
	if child:IsA("Model") and string.find(string.lower(child.Name), pattern, 1, true) then
		local pivot = child:GetPivot().Position
		if inside(pivot.X, pivot.Z) > -0.15 then
			child.Parent = removed
		end
	end
end

-- Part helpers ------------------------------------------------------------------

local function part(
	shape: Enum.PartType,
	size: Vector3,
	cframe: CFrame,
	color: Color3,
	material: Enum.Material
): Part
	local p = Instance.new("Part")
	p.Shape = shape
	p.Size = size
	p.CFrame = cframe
	p.Color = color
	p.Material = material
	p.Anchored = true
	p.CastShadow = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = root
	return p
end

-- A cylinder standing from `from` to `to`. Cylinder parts lie along X, so rotate.
local function limb(
	from: Vector3,
	to: Vector3,
	radius: number,
	color: Color3,
	material: Enum.Material
): Part
	local length = (to - from).Magnitude
	local mid = (from + to) / 2
	local cframe = CFrame.lookAt(mid, to) * CFrame.Angles(0, math.rad(90), 0)
	return part(
		Enum.PartType.Cylinder,
		Vector3.new(length, radius * 2, radius * 2),
		cframe,
		color,
		material
	)
end

-- Ground and water ---------------------------------------------------------------

if CONFIG.useTerrain then
	local terrain = Workspace.Terrain
	local depth = CONFIG.waterDepth
	local region = Region3.new(
		Vector3.new(
			center.X - halfX - CONFIG.shoreWidth,
			waterY - depth - 4,
			center.Z - halfZ - CONFIG.shoreWidth
		),
		Vector3.new(
			center.X + halfX + CONFIG.shoreWidth,
			waterY + 4,
			center.Z + halfZ + CONFIG.shoreWidth
		)
	):ExpandToGrid(4)
	local materials: any, occupancy: any = terrain:ReadVoxels(region, 4)
	local size = materials.Size
	local origin = region.CFrame.Position - region.Size / 2

	for ix = 1, size.X do
		for iz = 1, size.Z do
			local x = origin.X + (ix - 0.5) * 4
			local z = origin.Z + (iz - 0.5) * 4
			local depthIn = inside(x, z)
			-- Shore band just outside the blob turns to mud; the blob itself becomes water.
			local shore = depthIn > -(CONFIG.shoreWidth / math.min(halfX, halfZ))
			if depthIn < 0 and not shore then
				continue
			end
			for iy = 1, size.Y do
				local y = origin.Y + (iy - 0.5) * 4
				if y > waterY then
					materials[ix][iy][iz] = Enum.Material.Air
					occupancy[ix][iy][iz] = 0
				elseif depthIn >= 0 and y > waterY - depth then
					materials[ix][iy][iz] = Enum.Material.Water
					occupancy[ix][iy][iz] = 1
				else
					materials[ix][iy][iz] = Enum.Material.Mud
					occupancy[ix][iy][iz] = 1
				end
			end
		end
	end
	terrain:WriteVoxels(region, 4, materials, occupancy)
	terrain.WaterColor = WATER_COLOR
	terrain.WaterTransparency = 0.35
	terrain.WaterReflectance = 0.15
	terrain.WaterWaveSize = 0.05
	terrain.WaterWaveSpeed = 4
else
	local water = part(
		Enum.PartType.Block,
		Vector3.new(halfX * 2, CONFIG.waterDepth, halfZ * 2),
		CFrame.new(center.X, waterY - CONFIG.waterDepth / 2, center.Z),
		WATER_COLOR,
		Enum.Material.Glass
	)
	water.Name = "Water"
	water.Transparency = 0.4
	water.CanCollide = false
	local bed = part(
		Enum.PartType.Block,
		Vector3.new(halfX * 2 + CONFIG.shoreWidth * 2, 1, halfZ * 2 + CONFIG.shoreWidth * 2),
		CFrame.new(center.X, waterY - CONFIG.waterDepth - 0.5, center.Z),
		MUD_COLOR,
		Enum.Material.Mud
	)
	bed.Name = "Bed"
end

-- Dead trees: bare, leaning, branching. ------------------------------------------

local function deadBranch(
	from: Vector3,
	direction: Vector3,
	length: number,
	radius: number,
	level: number
)
	local to = from + direction * length
	limb(from, to, radius, DEAD_WOOD, Enum.Material.Wood)
	if level >= 4 or radius < 0.25 then
		return
	end
	local count = rng:NextInteger(2, 3)
	for _ = 1, count do
		local tilt = CFrame.Angles(
			rng:NextNumber(-0.9, 0.9),
			rng:NextNumber(0, math.pi * 2),
			rng:NextNumber(-0.9, 0.9)
		)
		local next = (tilt * direction).Unit
		-- Keep branches reaching upward and outward, never back into the water.
		next = Vector3.new(next.X, math.abs(next.Y) * 0.7 + 0.2, next.Z).Unit
		deadBranch(to, next, length * rng:NextNumber(0.55, 0.75), radius * 0.6, level + 1)
	end
end

for _ = 1, CONFIG.deadTrees do
	local base = randomPointInside(-0.05)
	-- Lean toward the middle of the water like the reference.
	local toCenter = (Vector3.new(center.X, waterY, center.Z) - base)
	local leanDir = if toCenter.Magnitude > 1 then toCenter.Unit else Vector3.xAxis
	local lean = leanDir * rng:NextNumber(0.15, 0.45)
	local up = (Vector3.yAxis + lean).Unit
	deadBranch(base - Vector3.yAxis * 2, up, rng:NextNumber(12, 20), rng:NextNumber(1.1, 1.6), 1)
end

-- The giant tree: thick buttressed trunk, aerial roots into the water, broad canopy. ---

local giant = randomPointInside(0.35)
giant = Vector3.new(giant.X, waterY, giant.Z)
local trunkHeight = 46
local trunkTop = giant + Vector3.yAxis * trunkHeight

do
	-- Trunk as stacked, slightly wandering segments so it reads gnarled.
	local prev = giant - Vector3.yAxis * 3
	local segments = 8
	for i = 1, segments do
		local t = i / segments
		local wander = Vector3.new(rng:NextNumber(-1.2, 1.2), 0, rng:NextNumber(-1.2, 1.2))
		local next = giant + Vector3.yAxis * (trunkHeight * t) + wander * (1 - t)
		local radius = 7.5 - 4.5 * t
		limb(prev, next, radius, LIVE_WOOD, Enum.Material.Wood)
		prev = next
	end

	-- Buttress roots at the base spreading into the water.
	for i = 1, 8 do
		local angle = (i / 8) * math.pi * 2 + rng:NextNumber(-0.2, 0.2)
		local dir = Vector3.new(math.cos(angle), 0, math.sin(angle))
		local from = giant + Vector3.yAxis * rng:NextNumber(4, 9)
		local to = giant + dir * rng:NextNumber(9, 15) - Vector3.yAxis * 2.5
		limb(from, to, rng:NextNumber(1.2, 2), LIVE_WOOD, Enum.Material.Wood)
	end

	-- Aerial roots dropping from the branch level straight down through the water line.
	for _ = 1, 14 do
		local angle = rng:NextNumber(0, math.pi * 2)
		local reach = rng:NextNumber(4, 12)
		local from = giant
			+ Vector3.yAxis * rng:NextNumber(22, 34)
			+ Vector3.new(math.cos(angle), 0, math.sin(angle)) * 3.5
		local to = giant
			+ Vector3.new(math.cos(angle), 0, math.sin(angle)) * reach
			- Vector3.yAxis * 2
		limb(from, to, rng:NextNumber(0.4, 1.0), LIVE_WOOD, Enum.Material.Wood)
	end

	-- Main limbs and the canopy on top of each.
	for i = 1, 6 do
		local angle = (i / 6) * math.pi * 2 + rng:NextNumber(-0.3, 0.3)
		local dir = Vector3.new(math.cos(angle), rng:NextNumber(0.25, 0.6), math.sin(angle)).Unit
		local from = trunkTop - Vector3.yAxis * rng:NextNumber(4, 12)
		local to = from + dir * rng:NextNumber(14, 22)
		limb(from, to, rng:NextNumber(1.4, 2.2), LIVE_WOOD, Enum.Material.Wood)
		for _ = 1, 3 do
			local puff = to
				+ Vector3.new(rng:NextNumber(-5, 5), rng:NextNumber(-2, 4), rng:NextNumber(-5, 5))
			local r = rng:NextNumber(6, 10)
			local leaf = part(
				Enum.PartType.Ball,
				Vector3.new(r, r * 0.75, r),
				CFrame.new(puff),
				LEAF_SHADES[rng:NextInteger(1, #LEAF_SHADES)],
				Enum.Material.Grass
			)
			leaf.CanCollide = false
		end
	end
	-- Crown fill so the canopy reads as one mass from below.
	for _ = 1, 8 do
		local puff = trunkTop
			+ Vector3.new(rng:NextNumber(-8, 8), rng:NextNumber(-2, 6), rng:NextNumber(-8, 8))
		local r = rng:NextNumber(8, 12)
		local leaf = part(
			Enum.PartType.Ball,
			Vector3.new(r, r * 0.7, r),
			CFrame.new(puff),
			LEAF_SHADES[rng:NextInteger(1, #LEAF_SHADES)],
			Enum.Material.Grass
		)
		leaf.CanCollide = false
	end

	-- Moss on the lower trunk and a few hanging vines.
	for _ = 1, 6 do
		local angle = rng:NextNumber(0, math.pi * 2)
		local pos = giant
			+ Vector3.new(math.cos(angle), 0, math.sin(angle)) * 6.2
			+ Vector3.yAxis * rng:NextNumber(2, 14)
		local moss = part(
			Enum.PartType.Ball,
			Vector3.new(3, 4, 2),
			CFrame.new(pos),
			MOSS,
			Enum.Material.Grass
		)
		moss.CanCollide = false
	end
	for _ = 1, 10 do
		local angle = rng:NextNumber(0, math.pi * 2)
		local from = trunkTop
			- Vector3.yAxis * rng:NextNumber(6, 14)
			+ Vector3.new(math.cos(angle), 0, math.sin(angle)) * rng:NextNumber(6, 16)
		local to = from - Vector3.yAxis * rng:NextNumber(10, 24)
		local vine = limb(from, to, 0.18, MOSS, Enum.Material.Grass)
		vine.CanCollide = false
	end
end

-- Lily pads and reeds -----------------------------------------------------------

for _ = 1, CONFIG.lilyPads do
	local pos = randomPointInside(0.1)
	local r = rng:NextNumber(1.2, 2.4)
	local pad = part(
		Enum.PartType.Cylinder,
		Vector3.new(0.15, r * 2, r * 2),
		CFrame.new(pos + Vector3.yAxis * 0.08)
			* CFrame.Angles(0, rng:NextNumber(0, math.pi), math.rad(90)),
		Color3.fromRGB(70, 120, 58),
		Enum.Material.Grass
	)
	pad.Name = "LilyPad"
	pad.CanCollide = false
end

for _ = 1, CONFIG.reeds do
	-- Reeds cluster right on the waterline.
	local pos = randomPointInside(-0.08)
	if inside(pos.X, pos.Z) > 0.12 then
		continue
	end
	local h = rng:NextNumber(3, 6)
	local reed = limb(
		pos - Vector3.yAxis * 0.5,
		pos
			+ Vector3.yAxis * h
			+ Vector3.new(rng:NextNumber(-0.4, 0.4), 0, rng:NextNumber(-0.4, 0.4)),
		0.12,
		Color3.fromRGB(92, 128, 60),
		Enum.Material.Grass
	)
	reed.Name = "Reed"
	reed.CanCollide = false
end

-- Mist over the water and the fog zone the client script reacts to. ----------------

local mist = part(
	Enum.PartType.Block,
	Vector3.new(halfX * 2, 1, halfZ * 2),
	CFrame.new(center.X, waterY + 1.5, center.Z),
	Color3.new(1, 1, 1),
	Enum.Material.SmoothPlastic
)
mist.Name = "Mist"
mist.Transparency = 1
mist.CanCollide = false
mist.CanQuery = false

local emitter = Instance.new("ParticleEmitter")
emitter.Texture = "rbxasset://textures/particles/smoke_main.dds"
emitter.Color = ColorSequence.new(Color3.fromRGB(198, 214, 190))
emitter.Transparency = NumberSequence.new({
	NumberSequenceKeypoint.new(0, 1),
	NumberSequenceKeypoint.new(0.3, 0.86),
	NumberSequenceKeypoint.new(1, 1),
})
emitter.Size = NumberSequence.new(14, 22)
emitter.Lifetime = NumberRange.new(6, 10)
emitter.Rate = math.clamp((halfX * halfZ) / 220, 4, 24)
emitter.Speed = NumberRange.new(0.3, 0.8)
emitter.SpreadAngle = Vector2.new(180, 180)
emitter.Rotation = NumberRange.new(0, 360)
emitter.RotSpeed = NumberRange.new(-4, 4)
emitter.LightInfluence = 1
emitter.Shape = Enum.ParticleEmitterShape.Box
emitter.ShapeInOut = Enum.ParticleEmitterShapeInOut.Outward
emitter.Parent = mist

local zone = part(
	Enum.PartType.Block,
	Vector3.new(halfX * 2 + CONFIG.shoreWidth * 2, 40, halfZ * 2 + CONFIG.shoreWidth * 2),
	CFrame.new(center.X, waterY + 18, center.Z),
	Color3.new(1, 1, 1),
	Enum.Material.SmoothPlastic
)
zone.Name = "FogZone"
zone.Transparency = 1
zone.CanCollide = false
zone.CanQuery = false
CollectionService:AddTag(zone, "SwampZone")

marker.Transparency = 1
marker.CanCollide = false
print(
	`Swamp built under Workspace.Swamp. {#removed:GetChildren()} trees parked in Workspace.SwampRemovedTrees.`
)
