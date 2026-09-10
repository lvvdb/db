--!strict
-- Thickens the fog while the player stands inside any part tagged "SwampZone"
-- (tools/BuildSwamp.lua tags the zone it builds). Eases back out on leaving.

local CollectionService = game:GetService("CollectionService")
local Lighting = game:GetService("Lighting")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")

local TAG = "SwampZone"
local FADE = TweenInfo.new(1.6, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut)

local SWAMP = {
	FogColor = Color3.fromRGB(150, 166, 140),
	FogStart = 10,
	FogEnd = 140,
}

local player = Players.LocalPlayer
local outside = {
	FogColor = Lighting.FogColor,
	FogStart = Lighting.FogStart,
	FogEnd = Lighting.FogEnd,
}
local atmosphere = Lighting:FindFirstChildOfClass("Atmosphere")
local outsideDensity = if atmosphere then atmosphere.Density else 0

local insideZone = false

local function contains(zone: BasePart, position: Vector3): boolean
	local local_ = zone.CFrame:PointToObjectSpace(position)
	local half = zone.Size / 2
	return math.abs(local_.X) <= half.X
		and math.abs(local_.Y) <= half.Y
		and math.abs(local_.Z) <= half.Z
end

local function apply(inside: boolean)
	if inside == insideZone then
		return
	end
	insideZone = inside
	TweenService:Create(Lighting, FADE, if inside then SWAMP else outside):Play()
	if atmosphere then
		TweenService:Create(
			atmosphere,
			FADE,
			{ Density = if inside then math.max(outsideDensity, 0.55) else outsideDensity }
		):Play()
	end
end

local accumulator = 0
RunService.Heartbeat:Connect(function(dt: number)
	accumulator += dt
	if accumulator < 0.2 then
		return
	end
	accumulator = 0

	local character = player.Character
	local rootPart = if character then character:FindFirstChild("HumanoidRootPart") else nil
	if not rootPart or not rootPart:IsA("BasePart") then
		return
	end
	local position = rootPart.Position
	for _, zone in CollectionService:GetTagged(TAG) do
		if zone:IsA("BasePart") and contains(zone, position) then
			apply(true)
			return
		end
	end
	apply(false)
end)
