--!strict
-- The "shop" page: header, GAMEPASSES label, one wide featured VIP card and three
-- equal small cards. Built from UICorner / UIStroke / UIGradient; only the icons and
-- the tile textures are baked images.
--
-- Purchases go through MarketplaceService:PromptGamePassPurchase and nothing else.
-- What a player owns is whatever the server last told us over ShopNet.

local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local SoundService = game:GetService("SoundService")

local ShopConfig = require(ReplicatedStorage.Shared.ShopConfig)
local ShopNet = require(ReplicatedStorage.Shared.ShopNet)
local Effects = require(script.Parent.Effects)
local Theme = require(script.Parent.Theme)

type Pass = ShopConfig.Pass

export type Deps = {
	onClose: (() -> ())?,
	-- The settings motion toggle. Defaults to the platform reduce-motion flag.
	motionEnabled: (() -> boolean)?,
}

export type Handle = {
	root: Frame,
	setOwned: (owned: { [string]: boolean }) -> (),
	destroy: () -> (),
}

type PassView = {
	pass: Pass,
	prices: { TextLabel },
	buyLabel: TextLabel?,
	buyGradient: UIGradient?,
	ownedBadge: Frame?,
	owned: boolean,
}

type Context = {
	sound: Sound,
	stops: { () -> () },
}

local PANEL_SIZE = Vector2.new(1000, 620)
local MIN_TOUCH = 48
local Z_CONTENT = 3

local colors = Theme.colors
local assets = ShopConfig.assets

local ShopPage = {}

-- Builders --------------------------------------------------------------------

local function minTouch(target: GuiObject)
	local constraint = Instance.new("UISizeConstraint")
	constraint.MinSize = Vector2.new(MIN_TOUCH, MIN_TOUCH)
	constraint.Parent = target
end

local function square(target: GuiObject)
	local aspect = Instance.new("UIAspectRatioConstraint")
	aspect.AspectRatio = 1
	aspect.DominantAxis = Enum.DominantAxis.Height
	aspect.Parent = target
end

local function button(
	parent: Instance,
	name: string,
	size: UDim2,
	position: UDim2,
	anchor: Vector2
): TextButton
	local target = Instance.new("TextButton")
	target.Name = name
	target.Text = ""
	target.AutoButtonColor = false
	target.BackgroundColor3 = Color3.new(1, 1, 1)
	target.Size = size
	target.Position = position
	target.AnchorPoint = anchor
	target.ZIndex = Z_CONTENT
	target.Parent = parent
	return target
end

local function icon(
	parent: Instance,
	image: string,
	height: number,
	position: UDim2,
	anchor: Vector2
): ImageLabel
	local label = Instance.new("ImageLabel")
	label.Name = "Icon"
	label.BackgroundTransparency = 1
	label.Image = image
	label.Size = UDim2.fromScale(0, height)
	label.Position = position
	label.AnchorPoint = anchor
	label.ZIndex = Z_CONTENT
	square(label)
	label.Parent = parent
	return label
end

local function priceLabel(
	parent: Instance,
	pass: Pass,
	size: UDim2,
	position: UDim2,
	rotation: number,
	maxTextSize: number
): TextLabel
	local label = Theme.text(parent, ShopConfig.formatPrice(pass.fallbackPrice), {
		name = "Price",
		size = size,
		position = position,
		anchor = Vector2.new(0.5, 0.5),
		color = colors.price,
		rotation = rotation,
		maxTextSize = maxTextSize,
		strokeThickness = Theme.outline.text,
	})
	return label
end

-- Root frame: 1000 x 620 on desktop, scales to width on smaller screens.
local function buildPanel(parent: Instance): (Frame, Frame)
	local root = Instance.new("Frame")
	root.Name = "ShopPage"
	root.BackgroundTransparency = 1
	root.AnchorPoint = Vector2.new(0.5, 0.5)
	root.Position = UDim2.fromScale(0.5, 0.5)
	root.Size = UDim2.fromScale(0.94, 0.94)

	local aspect = Instance.new("UIAspectRatioConstraint")
	aspect.AspectRatio = PANEL_SIZE.X / PANEL_SIZE.Y
	aspect.AspectType = Enum.AspectType.FitWithinMaxSize
	aspect.DominantAxis = Enum.DominantAxis.Width
	aspect.Parent = root

	local maxSize = Instance.new("UISizeConstraint")
	maxSize.MaxSize = PANEL_SIZE
	maxSize.Parent = root

	local shadow = Instance.new("Frame")
	shadow.Name = "Shadow"
	shadow.BackgroundColor3 = colors.shadow
	shadow.BackgroundTransparency = 0.55
	shadow.Size = UDim2.fromScale(1, 1)
	shadow.Position = UDim2.fromOffset(0, 10)
	shadow.ZIndex = 1
	Theme.corner(shadow, Theme.radius.panel)
	shadow.Parent = root

	local panel = Instance.new("Frame")
	panel.Name = "Panel"
	panel.BackgroundColor3 = colors.panel
	panel.Size = UDim2.fromScale(1, 1)
	panel.ZIndex = 2
	Theme.corner(panel, Theme.radius.panel)
	Theme.stroke(panel, Theme.outline.panel)
	Theme.gradient(panel, { colors.panelLight, colors.panel }, 90)

	local padding = Instance.new("UIPadding")
	padding.PaddingLeft = UDim.new(0.014, 0)
	padding.PaddingRight = UDim.new(0.014, 0)
	padding.PaddingTop = UDim.new(0.022, 0)
	padding.PaddingBottom = UDim.new(0.022, 0)
	padding.Parent = panel

	local layout = Instance.new("UIListLayout")
	layout.FillDirection = Enum.FillDirection.Vertical
	layout.HorizontalAlignment = Enum.HorizontalAlignment.Center
	layout.SortOrder = Enum.SortOrder.LayoutOrder
	layout.Padding = UDim.new(0.015, 0)
	layout.Parent = panel

	panel.Parent = root
	root.Parent = parent
	return root, panel
end

local function buildHeader(panel: Frame, ctx: Context, onClose: (() -> ())?)
	local header = Instance.new("Frame")
	header.Name = "Header"
	header.BackgroundColor3 = Color3.new(1, 1, 1)
	header.Size = UDim2.fromScale(1, 0.22)
	header.LayoutOrder = 1
	header.ClipsDescendants = true
	Theme.gradient(header, { colors.vermilion, colors.orange, colors.gold }, 0)
	Theme.corner(header, Theme.radius.card)
	Theme.stroke(header, Theme.outline.card)
	Theme.tile(header, assets.triangleTile, 0.88, 28)

	icon(header, assets.licenceIcon, 0.74, UDim2.fromScale(0.025, 0.5), Vector2.new(0, 0.5))

	-- Bouncy title: one label per letter, tilted alternately.
	local title = Instance.new("Frame")
	title.Name = "Title"
	title.BackgroundTransparency = 1
	title.Position = UDim2.fromScale(0.16, 0.5)
	title.AnchorPoint = Vector2.new(0, 0.5)
	title.Size = UDim2.fromScale(0.5, 0.9)
	local titleLayout = Instance.new("UIListLayout")
	titleLayout.FillDirection = Enum.FillDirection.Horizontal
	titleLayout.VerticalAlignment = Enum.VerticalAlignment.Center
	titleLayout.SortOrder = Enum.SortOrder.LayoutOrder
	titleLayout.Padding = UDim.new(0.005, 0)
	titleLayout.Parent = title
	title.Parent = header

	local letters: { TextLabel } = {}
	for i, letter in { "S", "H", "O", "P" } do
		local label = Theme.text(title, letter, {
			name = letter,
			size = UDim2.fromScale(0.2, 1),
			maxTextSize = 110,
			rotation = if i % 2 == 1 then -4 else 4,
			strokeThickness = Theme.outline.panel,
			shadow = true,
			layoutOrder = i,
		})
		table.insert(letters, label)
	end
	table.insert(ctx.stops, Effects.gleam(letters))

	local close = button(
		header,
		"Close",
		UDim2.fromScale(0, 0.62),
		UDim2.fromScale(0.975, 0.5),
		Vector2.new(1, 0.5)
	)
	square(close)
	minTouch(close)
	Theme.gradient(close, { colors.closeTop, colors.closeBottom }, 90)
	Theme.corner(close, Theme.radius.button)
	Theme.stroke(close, Theme.outline.card)
	Theme.text(close, "X", {
		size = UDim2.fromScale(0.8, 0.8),
		position = UDim2.fromScale(0.5, 0.5),
		anchor = Vector2.new(0.5, 0.5),
		maxTextSize = 48,
	})
	table.insert(ctx.stops, Effects.smooth(close, { sound = ctx.sound }))
	close.Activated:Connect(function()
		if onClose then
			onClose()
		end
	end)

	header.Parent = panel
end

local function buildSectionLabel(panel: Frame)
	Theme.text(panel, "GAMEPASSES", {
		name = "SectionLabel",
		size = UDim2.fromScale(0.5, 0.06),
		maxTextSize = 26,
		layoutOrder = 2,
	})
end

local function buildFeatured(panel: Frame, ctx: Context, onPrompt: (PassView) -> ()): PassView
	local pass = ShopConfig.featured

	local card = button(panel, "Featured", UDim2.fromScale(1, 0.28), UDim2.new(), Vector2.zero)
	card.LayoutOrder = 3
	Theme.gradient(card, { pass.gradient.top, pass.gradient.bottom }, 90)
	Theme.corner(card, Theme.radius.card)
	Theme.stroke(card, Theme.outline.card)
	Theme.tile(card, assets.lattice, 0.85, 32)
	Theme.tile(card, assets.watermark, 0.9, 64)

	-- Left: crest above VIP.
	icon(card, pass.icon, 0.5, UDim2.fromScale(0.12, 0.3), Vector2.new(0.5, 0.5))
	local vip = Theme.text(card, pass.title, {
		name = "Title",
		size = UDim2.fromScale(0.2, 0.36),
		position = UDim2.fromScale(0.12, 0.76),
		anchor = Vector2.new(0.5, 0.5),
		maxTextSize = 64,
		strokeThickness = Theme.outline.card,
		shadow = true,
	})
	Theme.gradient(vip, { colors.vipTop, colors.vipBottom }, 90)
	table.insert(ctx.stops, Effects.gleam({ vip }))

	-- Middle: the two benefit lines.
	Theme.text(card, pass.lines[1] or "", {
		name = "Line1",
		size = UDim2.fromScale(0.46, 0.34),
		position = UDim2.fromScale(0.25, 0.33),
		anchor = Vector2.new(0, 0.5),
		alignX = Enum.TextXAlignment.Left,
		maxTextSize = 40,
		strokeThickness = Theme.outline.card,
		shadow = true,
	})
	Theme.text(card, pass.lines[2] or "", {
		name = "Line2",
		size = UDim2.fromScale(0.46, 0.22),
		position = UDim2.fromScale(0.25, 0.68),
		anchor = Vector2.new(0, 0.5),
		alignX = Enum.TextXAlignment.Left,
		maxTextSize = 26,
	})

	-- Right: BUY with the price floating above-left of it.
	local buy = button(
		card,
		"Buy",
		UDim2.fromScale(0.22, 0.4),
		UDim2.fromScale(0.97, 0.9),
		Vector2.new(1, 1)
	)
	minTouch(buy)
	local buyGradient = Theme.gradient(buy, { colors.buyTop, colors.buyBottom }, 90)
	Theme.corner(buy, Theme.radius.button)
	Theme.stroke(buy, Theme.outline.card)
	local buyLabel = Theme.text(buy, "BUY", {
		size = UDim2.fromScale(0.8, 0.75),
		position = UDim2.fromScale(0.5, 0.5),
		anchor = Vector2.new(0.5, 0.5),
		maxTextSize = 40,
	})
	local price =
		priceLabel(card, pass, UDim2.fromScale(0.16, 0.26), UDim2.fromScale(0.76, 0.32), -10, 30)

	table.insert(ctx.stops, Effects.smooth(card, { sound = ctx.sound }))
	table.insert(ctx.stops, Effects.smooth(buy, { sound = ctx.sound }))
	table.insert(ctx.stops, Effects.rain(card, assets.crestSprite, { count = 12, duration = 6 }))

	local view: PassView = {
		pass = pass,
		prices = { price },
		buyLabel = buyLabel,
		buyGradient = buyGradient,
		ownedBadge = nil,
		owned = false,
	}
	card.Activated:Connect(function()
		onPrompt(view)
	end)
	buy.Activated:Connect(function()
		onPrompt(view)
	end)
	return view
end

local function buildRow(panel: Frame): Frame
	local row = Instance.new("Frame")
	row.Name = "Cards"
	row.BackgroundTransparency = 1
	row.Size = UDim2.fromScale(1, 0.35)
	row.LayoutOrder = 4
	local layout = Instance.new("UIListLayout")
	layout.FillDirection = Enum.FillDirection.Horizontal
	layout.HorizontalAlignment = Enum.HorizontalAlignment.Center
	layout.VerticalAlignment = Enum.VerticalAlignment.Center
	layout.SortOrder = Enum.SortOrder.LayoutOrder
	layout.Padding = UDim.new(0.02, 0)
	layout.Parent = row
	row.Parent = panel
	return row
end

local function buildOwnedBadge(card: GuiObject): Frame
	local badge = Instance.new("Frame")
	badge.Name = "Owned"
	badge.BackgroundColor3 = Color3.new(1, 1, 1)
	badge.Size = UDim2.fromScale(0.36, 0.14)
	badge.Position = UDim2.fromScale(0.96, 0.04)
	badge.AnchorPoint = Vector2.new(1, 0)
	badge.ZIndex = Z_CONTENT + 2
	badge.Visible = false
	Theme.gradient(badge, { colors.ownedTop, colors.ownedBottom }, 90)
	Theme.corner(badge, Theme.radius.badge)
	Theme.stroke(badge, 2)
	Theme.text(badge, "OWNED", {
		size = UDim2.fromScale(0.9, 0.8),
		position = UDim2.fromScale(0.5, 0.5),
		anchor = Vector2.new(0.5, 0.5),
		maxTextSize = 16,
		zIndex = Z_CONTENT + 2,
		strokeThickness = 2,
	})
	badge.Parent = card
	return badge
end

local function buildCard(
	row: Frame,
	pass: Pass,
	order: number,
	ctx: Context,
	onPrompt: (PassView) -> ()
): PassView
	local card = button(row, pass.key, UDim2.fromScale(0.32, 1), UDim2.new(), Vector2.zero)
	card.LayoutOrder = order
	Theme.gradient(card, { pass.gradient.top, pass.gradient.bottom }, 90)
	Theme.corner(card, Theme.radius.card)
	Theme.stroke(card, Theme.outline.card)
	Theme.tile(card, assets.lattice, 0.85, 32)

	local title = Theme.text(card, pass.title, {
		name = "Title",
		size = UDim2.fromScale(0.92, 0.2),
		position = UDim2.fromScale(0.5, 0.14),
		anchor = Vector2.new(0.5, 0.5),
		maxTextSize = 30,
		shadow = true,
	})
	table.insert(ctx.stops, Effects.gleam({ title }))

	icon(card, pass.icon, 0.46, UDim2.fromScale(0.5, 0.5), Vector2.new(0.5, 0.5))

	local priceSize = UDim2.fromScale(0.28, 0.16)
	local left = priceLabel(card, pass, priceSize, UDim2.fromScale(0.17, 0.5), -10, 26)
	local right = priceLabel(card, pass, priceSize, UDim2.fromScale(0.83, 0.5), 10, 26)

	Theme.text(card, pass.lines[1] or "", {
		name = "Benefit",
		size = UDim2.fromScale(0.92, 0.15),
		position = UDim2.fromScale(0.5, 0.87),
		anchor = Vector2.new(0.5, 0.5),
		maxTextSize = 22,
	})

	table.insert(ctx.stops, Effects.smooth(card, { sound = ctx.sound }))

	local view: PassView = {
		pass = pass,
		prices = { left, right },
		buyLabel = nil,
		buyGradient = nil,
		ownedBadge = buildOwnedBadge(card),
		owned = false,
	}
	card.Activated:Connect(function()
		onPrompt(view)
	end)
	return view
end

-- Behaviour -------------------------------------------------------------------

local function applyOwned(view: PassView, owned: boolean)
	view.owned = owned
	for _, price in view.prices do
		price.Visible = not owned
	end
	if view.buyLabel then
		view.buyLabel.Text = if owned then "OWNED" else "BUY"
	end
	if view.buyGradient then
		view.buyGradient.Color = if owned
			then Theme.colorSequence({ colors.ownedTop, colors.ownedBottom })
			else Theme.colorSequence({ colors.buyTop, colors.buyBottom })
	end
	if view.ownedBadge then
		view.ownedBadge.Visible = owned
	end
end

local function prompt(view: PassView)
	if view.owned then
		return
	end
	local id = view.pass.gamepassId
	if id <= 0 then
		warn(`[Shop] {view.pass.key} has no gamepass id yet, not prompting`)
		return
	end
	MarketplaceService:PromptGamePassPurchase(Players.LocalPlayer, id)
end

-- Live prices replace the fallbacks as GetProductInfo answers.
local function refreshPrices(views: { [string]: PassView })
	for _, view in views do
		if view.pass.gamepassId <= 0 then
			continue
		end
		task.spawn(function()
			local ok, info: any = pcall(function()
				return MarketplaceService:GetProductInfo(
					view.pass.gamepassId,
					Enum.InfoType.GamePass
				)
			end)
			if not ok or type(info) ~= "table" or type(info.PriceInRobux) ~= "number" then
				return
			end
			local text = ShopConfig.formatPrice(info.PriceInRobux)
			for _, label in view.prices do
				label.Text = text
			end
		end)
	end
end

-- Mount -----------------------------------------------------------------------

function ShopPage.mount(parent: Instance, deps: Deps?): Handle
	local d: Deps = deps or {}
	if d.motionEnabled then
		Effects.setMotionSource(d.motionEnabled)
	end

	local sound = Instance.new("Sound")
	sound.Name = "ShopClick"
	sound.SoundId = assets.clickSound
	sound.Volume = 0.6
	sound.Parent = SoundService

	local ctx: Context = { sound = sound, stops = {} }
	local views: { [string]: PassView } = {}

	local root, panel = buildPanel(parent)
	buildHeader(panel, ctx, d.onClose)
	buildSectionLabel(panel)
	views[ShopConfig.featured.key] = buildFeatured(panel, ctx, prompt)
	local row = buildRow(panel)
	for i, pass in ShopConfig.cards do
		views[pass.key] = buildCard(row, pass, i, ctx, prompt)
	end
	refreshPrices(views)

	local function setOwned(owned: { [string]: boolean })
		for key, view in views do
			applyOwned(view, owned[key] == true)
		end
	end

	-- Ownership only ever arrives from the server. Ask once on mount (the page may
	-- open long after the join-time push); the server pushes again after a purchase.
	local alive = true
	local connection: RBXScriptConnection? = nil
	task.spawn(function()
		local event = ShopNet.getOwnershipEvent()
		if not alive then
			return
		end
		connection = event.OnClientEvent:Connect(function(owned: { [string]: boolean })
			setOwned(owned)
		end)
		event:FireServer()
	end)

	local function destroy()
		alive = false
		if connection then
			connection:Disconnect()
		end
		for _, stop in ctx.stops do
			stop()
		end
		sound:Destroy()
		root:Destroy()
	end

	return { root = root, setOwned = setOwned, destroy = destroy }
end

return ShopPage
