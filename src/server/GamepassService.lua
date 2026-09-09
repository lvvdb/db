--!strict
-- Server authority for gamepass ownership.
--
-- Ownership is established only from MarketplaceService: UserOwnsGamePassAsync on join
-- and on a (rate limited) client refresh request, and the server-side
-- PromptGamePassPurchaseFinished signal for purchases made this session. Nothing a
-- client sends is ever treated as proof of ownership.

local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local ShopConfig = require(ReplicatedStorage.Shared.ShopConfig)
local ShopNet = require(ReplicatedStorage.Shared.ShopNet)

type Pass = ShopConfig.Pass
type Perk = ShopConfig.Perk
type PerkKind = ShopConfig.PerkKind

export type PerkHandler = (player: Player, perk: Perk, pass: Pass) -> ()

-- Seconds between client-requested re-checks per player.
local REFRESH_COOLDOWN = 5

local GamepassService = {}

local owned: { [Player]: { [string]: boolean } } = {}
local lastRefresh: { [Player]: number } = {}
local handlers: { [string]: PerkHandler } = {}
local started = false

local ATTRIBUTE: { [string]: string } = {
	licenceFrame = "GoldLicenceFrame",
	vipTag = "VIPTag",
	konPelts = "KonPelts",
	outfitSlots = "OutfitSlots",
	tavernAccess = "TavernAccess",
}

-- Default handlers only stamp an attribute on the player so the rest of the client
-- can react. Register real handlers with setPerkHandler; anything that must survive
-- a rejoin (the pelts, the extra slots) has to be written to the game's data store
-- there, this module never persists anything.
local function defaultHandler(player: Player, perk: Perk)
	local attribute = ATTRIBUTE[perk.kind]
	if perk.amount then
		player:SetAttribute(attribute, perk.amount)
	else
		player:SetAttribute(attribute, true)
	end
end

local function grant(player: Player, pass: Pass)
	local set = owned[player]
	if not set or set[pass.key] then
		return
	end
	set[pass.key] = true
	for _, perk in pass.perks do
		local handler = handlers[perk.kind] or defaultHandler
		local ok, err = pcall(handler, player, perk, pass)
		if not ok then
			warn(`[GamepassService] perk {perk.kind} for {pass.key} failed: {err}`)
		end
	end
end

local function userOwns(player: Player, pass: Pass): boolean
	if pass.gamepassId <= 0 then
		return false
	end
	local ok, result = pcall(function()
		return MarketplaceService:UserOwnsGamePassAsync(player.UserId, pass.gamepassId)
	end)
	if not ok then
		warn(`[GamepassService] UserOwnsGamePassAsync failed for {pass.key}: {result}`)
		return false
	end
	return result == true
end

local function push(player: Player)
	local set = owned[player]
	if set then
		ShopNet.getOwnershipEvent():FireClient(player, table.clone(set))
	end
end

local function refresh(player: Player)
	for _, pass in ShopConfig.all do
		if owned[player] == nil then
			return -- left while we were yielding
		end
		if userOwns(player, pass) then
			grant(player, pass)
		end
	end
	push(player)
end

local function onPlayerAdded(player: Player)
	owned[player] = {}
	task.spawn(refresh, player)
end

local function onPlayerRemoving(player: Player)
	owned[player] = nil
	lastRefresh[player] = nil
end

local function onPurchaseFinished(player: Player, gamePassId: number, wasPurchased: boolean)
	if not wasPurchased then
		return
	end
	for _, pass in ShopConfig.all do
		if pass.gamepassId == gamePassId then
			grant(player, pass)
			push(player)
			return
		end
	end
end

local function onClientRefresh(player: Player)
	local now = os.clock()
	local last = lastRefresh[player]
	if last and now - last < REFRESH_COOLDOWN then
		push(player) -- answer from what we already know
		return
	end
	lastRefresh[player] = now
	task.spawn(refresh, player)
end

-- Replace the default attribute stamp for one perk kind. Call before start().
function GamepassService.setPerkHandler(kind: PerkKind, handler: PerkHandler)
	handlers[kind] = handler
end

function GamepassService.owns(player: Player, passKey: string): boolean
	local set = owned[player]
	return set ~= nil and set[passKey] == true
end

function GamepassService.start()
	if started then
		return
	end
	started = true

	local event = ShopNet.getOwnershipEvent()
	event.OnServerEvent:Connect(onClientRefresh)
	MarketplaceService.PromptGamePassPurchaseFinished:Connect(onPurchaseFinished)
	Players.PlayerAdded:Connect(onPlayerAdded)
	Players.PlayerRemoving:Connect(onPlayerRemoving)
	for _, player in Players:GetPlayers() do
		onPlayerAdded(player)
	end
end

return GamepassService
