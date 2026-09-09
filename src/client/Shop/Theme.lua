--!strict
-- Shared look for the shop: palette, pixel font and the small builders that turn
-- UICorner / UIStroke / UIGradient into "candy pixel" tiles without baked images.

local Theme = {}

Theme.colors = {
	outline = Color3.fromRGB(20, 26, 28),
	panel = Color3.fromRGB(31, 42, 46),
	panelLight = Color3.fromRGB(44, 58, 63),
	backdrop = Color3.fromRGB(42, 46, 51),
	text = Color3.fromRGB(236, 236, 236),
	price = Color3.fromRGB(92, 224, 92),
	vermilion = Color3.fromRGB(198, 75, 52),
	orange = Color3.fromRGB(240, 138, 42),
	gold = Color3.fromRGB(232, 185, 60),
	closeTop = Color3.fromRGB(255, 90, 90),
	closeBottom = Color3.fromRGB(196, 42, 42),
	buyTop = Color3.fromRGB(156, 240, 122),
	buyBottom = Color3.fromRGB(62, 194, 62),
	ownedTop = Color3.fromRGB(196, 196, 196),
	ownedBottom = Color3.fromRGB(112, 112, 112),
	vipTop = Color3.fromRGB(255, 214, 92),
	vipBottom = Color3.fromRGB(240, 138, 42),
	shadow = Color3.fromRGB(0, 0, 0),
}

Theme.font = Font.fromEnum(Enum.Font.Arcade)
Theme.radius = { panel = 18, card = 14, button = 10, badge = 6 }
Theme.outline = { panel = 5, card = 4, text = 3 }

function Theme.corner(parent: Instance, radius: number): UICorner
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, radius)
	corner.Parent = parent
	return corner
end

function Theme.stroke(parent: Instance, thickness: number, color: Color3?): UIStroke
	local stroke = Instance.new("UIStroke")
	stroke.Thickness = thickness
	stroke.Color = color or Theme.colors.outline
	stroke.LineJoinMode = Enum.LineJoinMode.Round
	-- Text gets an outline around the glyphs; everything else (cards and buttons
	-- included, their text lives in a child label) gets a border.
	stroke.ApplyStrokeMode = if parent:IsA("TextLabel")
		then Enum.ApplyStrokeMode.Contextual
		else Enum.ApplyStrokeMode.Border
	stroke.Parent = parent
	return stroke
end

function Theme.colorSequence(stops: { Color3 }): ColorSequence
	if #stops == 1 then
		return ColorSequence.new(stops[1])
	end
	local keypoints = {}
	for i, color in stops do
		table.insert(keypoints, ColorSequenceKeypoint.new((i - 1) / (#stops - 1), color))
	end
	return ColorSequence.new(keypoints)
end

-- rotation 0 runs left to right, 90 runs top to bottom.
function Theme.gradient(parent: Instance, stops: { Color3 }, rotation: number): UIGradient
	local gradient = Instance.new("UIGradient")
	gradient.Color = Theme.colorSequence(stops)
	gradient.Rotation = rotation
	gradient.Parent = parent
	return gradient
end

-- Full-size tiled texture behind a card's content.
function Theme.tile(
	parent: GuiObject,
	image: string,
	transparency: number,
	tileSize: number
): ImageLabel
	local tile = Instance.new("ImageLabel")
	tile.Name = "Tile"
	tile.BackgroundTransparency = 1
	tile.Size = UDim2.fromScale(1, 1)
	tile.Image = image
	tile.ImageTransparency = transparency
	tile.ScaleType = Enum.ScaleType.Tile
	tile.TileSize = UDim2.fromOffset(tileSize, tileSize)
	tile.ZIndex = 1
	tile.Parent = parent
	return tile
end

export type TextOptions = {
	name: string?,
	size: UDim2,
	position: UDim2?,
	anchor: Vector2?,
	color: Color3?,
	maxTextSize: number?,
	alignX: Enum.TextXAlignment?,
	rotation: number?,
	zIndex: number?,
	strokeThickness: number?,
	shadow: boolean?,
	layoutOrder: number?,
}

-- Pixel text with an outline and an optional short hard drop shadow. Returns the
-- label plus the holder frame that carries its size, position and rotation.
function Theme.text(parent: Instance, text: string, opts: TextOptions): (TextLabel, Frame)
	local zIndex = opts.zIndex or 3

	local holder = Instance.new("Frame")
	holder.Name = opts.name or "Text"
	holder.BackgroundTransparency = 1
	holder.Size = opts.size
	holder.Position = opts.position or UDim2.new()
	holder.AnchorPoint = opts.anchor or Vector2.zero
	holder.Rotation = opts.rotation or 0
	holder.ZIndex = zIndex
	holder.LayoutOrder = opts.layoutOrder or 0

	local function makeLabel(name: string, color: Color3, order: number): TextLabel
		local label = Instance.new("TextLabel")
		label.Name = name
		label.BackgroundTransparency = 1
		label.Size = UDim2.fromScale(1, 1)
		label.Text = text
		label.TextColor3 = color
		label.FontFace = Theme.font
		label.TextScaled = true
		label.TextXAlignment = opts.alignX or Enum.TextXAlignment.Center
		label.ZIndex = order
		if opts.maxTextSize then
			local constraint = Instance.new("UITextSizeConstraint")
			constraint.MaxTextSize = opts.maxTextSize
			constraint.Parent = label
		end
		Theme.stroke(
			label,
			opts.strokeThickness or Theme.outline.text,
			if name == "Shadow" then Theme.colors.shadow else nil
		)
		label.Parent = holder
		return label
	end

	local shadow: TextLabel? = nil
	if opts.shadow then
		local shadowLabel = makeLabel("Shadow", Theme.colors.shadow, zIndex)
		shadowLabel.Position = UDim2.fromOffset(3, 3)
		shadow = shadowLabel
	end

	local label = makeLabel("Label", opts.color or Theme.colors.text, zIndex + 1)
	if shadow then
		local shadowLabel = shadow
		label:GetPropertyChangedSignal("Text"):Connect(function()
			shadowLabel.Text = label.Text
		end)
	end

	holder.Parent = parent
	return label, holder
end

return Theme
