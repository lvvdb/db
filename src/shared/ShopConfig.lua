--!strict
-- Gamepass catalogue for the Hunter Exam shop page.
--
-- Every gamepassId is 0 until the pass exists on the Creator Dashboard. A pass with
-- id 0 is still drawn, but the client never prompts for it and the server never grants
-- its perks. fallbackPrice is display only; the live price comes from
-- MarketplaceService:GetProductInfo at runtime.

export type PerkKind = "licenceFrame" | "vipTag" | "konPelts" | "outfitSlots" | "tavernAccess"

export type Perk = {
	kind: PerkKind,
	amount: number?,
}

export type Gradient = {
	top: Color3,
	bottom: Color3,
}

export type Pass = {
	key: string,
	gamepassId: number,
	title: string,
	fallbackPrice: number,
	-- Benefit copy, rendered exactly as written. The featured card shows two lines,
	-- the small cards show one along the bottom.
	lines: { string },
	icon: string,
	gradient: Gradient,
	perks: { Perk },
}

local ShopConfig = {}

-- Baked images and the click sound. Everything else on the page is UICorner,
-- UIStroke and UIGradient. Swap the ids once the art exists.
ShopConfig.assets = {
	licenceIcon = "rbxassetid://0", -- 3D Hunter Licence card, header left
	crestIcon = "rbxassetid://0", -- gold Hunter Association crest, featured card
	crestSprite = "rbxassetid://0", -- small gold crest that rains inside the featured card
	lattice = "rbxassetid://0", -- diamond-lattice halftone tile
	triangleTile = "rbxassetid://0", -- small white inverted triangles, header pattern
	watermark = "rbxassetid://0", -- gold crests and stars tile, featured card
	clickSound = "rbxassetid://0",
}

local featured: Pass = {
	key = "vip",
	gamepassId = 0,
	title = "VIP",
	fallbackPrice = 499,
	lines = { "+GOLD LICENCE FRAME", "+VIP TITLE & TAG" },
	icon = ShopConfig.assets.crestIcon,
	gradient = { top = Color3.fromRGB(255, 214, 92), bottom = Color3.fromRGB(232, 160, 32) },
	perks = { { kind = "licenceFrame" }, { kind = "vipTag" } },
}

local cards: { Pass } = {
	{
		key = "foxbearDen",
		gamepassId = 0,
		title = "FOXBEAR DEN",
		fallbackPrice = 349,
		lines = { "+3 KON PELTS" },
		icon = "rbxassetid://0", -- Kon the foxbear's head
		gradient = { top = Color3.fromRGB(255, 107, 107), bottom = Color3.fromRGB(198, 40, 40) },
		perks = { { kind = "konPelts", amount = 3 } },
	},
	{
		key = "outfitSlots",
		gamepassId = 0,
		title = "OUTFIT SLOTS",
		fallbackPrice = 199,
		lines = { "+8 SLOTS" },
		icon = "rbxassetid://0", -- wardrobe chest with a green jacket on a hanger
		gradient = { top = Color3.fromRGB(155, 224, 92), bottom = Color3.fromRGB(46, 139, 58) },
		perks = { { kind = "outfitSlots", amount = 8 } },
	},
	{
		key = "tavernPass",
		gamepassId = 0,
		title = "TAVERN PASS",
		fallbackPrice = 399,
		lines = { "DAILY AISLE" },
		icon = "rbxassetid://0", -- brass saloon key with a hanging tavern-sign tag
		gradient = { top = Color3.fromRGB(124, 200, 255), bottom = Color3.fromRGB(30, 95, 200) },
		perks = { { kind = "tavernAccess" } },
	},
}

ShopConfig.featured = featured
ShopConfig.cards = cards

local all: { Pass } = { featured }
local byKey: { [string]: Pass } = {}
for _, pass in cards do
	table.insert(all, pass)
end
for _, pass in all do
	byKey[pass.key] = pass
end

ShopConfig.all = all
ShopConfig.byKey = byKey

function ShopConfig.formatPrice(robux: number): string
	return `{robux}R`
end

return ShopConfig
