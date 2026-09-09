--!strict
-- Motion for the shop: hover/press scaling, the title gleam and the crest rain.
--
-- Every loop re-reads Effects.motionEnabled() each cycle, so flipping the settings
-- motion toggle stops the gleam and the rain in place without tearing the UI down.

local GuiService = game:GetService("GuiService")
local SoundService = game:GetService("SoundService")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")

local Effects = {}

local HOVER_INFO = TweenInfo.new(0.12, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
-- How often a paused loop re-checks the motion toggle.
local IDLE_POLL = 0.5
local WHITE = Color3.new(1, 1, 1)

local motionSource: (() -> boolean)? = nil

-- Point this at the settings motion toggle. Without one, the platform
-- reduce-motion flag decides.
function Effects.setMotionSource(source: (() -> boolean)?)
	motionSource = source
end

function Effects.motionEnabled(): boolean
	if motionSource then
		return motionSource()
	end
	local ok, reduced = pcall(function()
		return (GuiService :: any).ReducedMotionEnabled
	end)
	return not (ok and reduced == true)
end

-- Hover / press ---------------------------------------------------------------

export type SmoothOptions = {
	sound: Sound?,
	hoverScale: number?,
	pressScale: number?,
}

local function isPointer(input: InputObject): boolean
	return input.UserInputType == Enum.UserInputType.MouseButton1
		or input.UserInputType == Enum.UserInputType.Touch
end

-- Hover scales to 1.08 over 0.12 s (Quad out), press to 0.9 with a click sound.
-- Touch only ever gets the press state. Returns a cleanup function.
function Effects.smooth(target: GuiObject, options: SmoothOptions?): () -> ()
	local opts: SmoothOptions = options or {}
	local hoverScale = opts.hoverScale or 1.08
	local pressScale = opts.pressScale or 0.9

	local scale = Instance.new("UIScale")
	scale.Name = "Smooth"
	scale.Parent = target

	local hovered, pressed = false, false
	local function apply()
		local goal = if pressed then pressScale elseif hovered then hoverScale else 1
		TweenService:Create(scale, HOVER_INFO, { Scale = goal }):Play()
	end

	local connections = {
		target.MouseEnter:Connect(function()
			-- Touch raises MouseEnter too; touch does not get the hover state.
			if UserInputService:GetLastInputType() == Enum.UserInputType.Touch then
				return
			end
			hovered = true
			apply()
		end),
		target.MouseLeave:Connect(function()
			hovered = false
			pressed = false
			apply()
		end),
		target.InputBegan:Connect(function(input: InputObject)
			if not isPointer(input) then
				return
			end
			pressed = true
			apply()
			if opts.sound then
				SoundService:PlayLocalSound(opts.sound)
			end
		end),
		target.InputEnded:Connect(function(input: InputObject)
			if isPointer(input) then
				pressed = false
				apply()
			end
		end),
	}

	return function()
		for _, connection in connections do
			connection:Disconnect()
		end
		scale:Destroy()
	end
end

-- Gleam -----------------------------------------------------------------------

export type GleamOptions = {
	sweep: number?, -- seconds for one sweep across the whole group
	pause: number?, -- seconds between sweeps
	angle: number?, -- tilt of the light band in degrees
}

type GleamPart = {
	overlay: TextLabel,
	fill: UIGradient,
	stroke: UIGradient,
	sync: RBXScriptConnection,
}

-- Transparent everywhere except a narrow band in the middle.
local BAND = NumberSequence.new({
	NumberSequenceKeypoint.new(0, 1),
	NumberSequenceKeypoint.new(0.42, 1),
	NumberSequenceKeypoint.new(0.5, 0),
	NumberSequenceKeypoint.new(0.58, 1),
	NumberSequenceKeypoint.new(1, 1),
})

local function bandGradient(parent: Instance, angle: number): UIGradient
	local gradient = Instance.new("UIGradient")
	gradient.Transparency = BAND
	gradient.Rotation = angle
	gradient.Offset = Vector2.new(-1, 0)
	gradient.Parent = parent
	return gradient
end

-- A white copy of the label sits on top of it; a transparency band sweeps across
-- both the copy's fill and its outline so the light crosses fill and stroke alike.
local function makeOverlay(label: TextLabel, angle: number): GleamPart
	local overlay = Instance.new("TextLabel")
	overlay.Name = "Gleam"
	overlay.BackgroundTransparency = 1
	overlay.Size = UDim2.fromScale(1, 1)
	overlay.Text = label.Text
	overlay.FontFace = label.FontFace
	overlay.TextScaled = label.TextScaled
	overlay.TextSize = label.TextSize
	overlay.TextXAlignment = label.TextXAlignment
	overlay.TextYAlignment = label.TextYAlignment
	overlay.TextColor3 = WHITE
	overlay.ZIndex = label.ZIndex + 1
	overlay.Visible = false

	local sizeConstraint = label:FindFirstChildOfClass("UITextSizeConstraint")
	if sizeConstraint then
		sizeConstraint:Clone().Parent = overlay
	end

	local baseStroke = label:FindFirstChildOfClass("UIStroke")
	local stroke = Instance.new("UIStroke")
	stroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Contextual
	stroke.Thickness = if baseStroke then baseStroke.Thickness else 0
	stroke.LineJoinMode = if baseStroke then baseStroke.LineJoinMode else Enum.LineJoinMode.Round
	stroke.Color = WHITE
	stroke.Parent = overlay

	local fill = bandGradient(overlay, angle)
	local strokeGradient = bandGradient(stroke, angle)
	overlay.Parent = label

	local sync = label:GetPropertyChangedSignal("Text"):Connect(function()
		overlay.Text = label.Text
	end)

	return { overlay = overlay, fill = fill, stroke = strokeGradient, sync = sync }
end

-- One light sweep crosses the labels left to right in order (a multi-letter title
-- passes the sweep from letter to letter), then rests. Returns a cleanup function.
function Effects.gleam(labels: { TextLabel }, options: GleamOptions?): () -> ()
	local opts: GleamOptions = options or {}
	local sweep = opts.sweep or 0.8
	local pause = opts.pause or 2
	local angle = opts.angle or 20
	local info = TweenInfo.new(sweep / math.max(#labels, 1), Enum.EasingStyle.Linear)

	local parts: { GleamPart } = {}
	for _, label in labels do
		table.insert(parts, makeOverlay(label, angle))
	end

	local running = true
	local active: { Tween } = {}

	task.spawn(function()
		while running do
			if Effects.motionEnabled() then
				for _, part in parts do
					if not running then
						break
					end
					part.fill.Offset = Vector2.new(-1, 0)
					part.stroke.Offset = Vector2.new(-1, 0)
					part.overlay.Visible = true
					local fillTween =
						TweenService:Create(part.fill, info, { Offset = Vector2.new(1, 0) })
					local strokeTween =
						TweenService:Create(part.stroke, info, { Offset = Vector2.new(1, 0) })
					active = { fillTween, strokeTween }
					fillTween:Play()
					strokeTween:Play()
					fillTween.Completed:Wait()
					part.overlay.Visible = false
				end
				active = {}
				task.wait(pause)
			else
				task.wait(IDLE_POLL)
			end
		end
	end)

	return function()
		running = false
		for _, tween in active do
			tween:Cancel()
		end
		for _, part in parts do
			part.sync:Disconnect()
			part.overlay:Destroy()
		end
	end
end

-- Rain ------------------------------------------------------------------------

export type RainOptions = {
	count: number?,
	duration: number?, -- seconds for one sprite to cross the container
	size: number?, -- sprite height as a fraction of the container height
	transparency: number?,
}

-- Sprites fall from the top edge to the bottom edge of the container, evenly
-- staggered so the stream never bunches. The container clips them. Returns a
-- cleanup function.
function Effects.rain(container: GuiObject, image: string, options: RainOptions?): () -> ()
	local opts: RainOptions = options or {}
	local count = opts.count or 12
	local duration = opts.duration or 6
	local size = opts.size or 0.16
	local info = TweenInfo.new(duration, Enum.EasingStyle.Linear)

	container.ClipsDescendants = true

	local running = true
	local drops: { ImageLabel } = {}
	local active: { [ImageLabel]: Tween } = {}

	for i = 1, count do
		local drop = Instance.new("ImageLabel")
		drop.Name = "Drop"
		drop.BackgroundTransparency = 1
		drop.Image = image
		drop.ImageTransparency = opts.transparency or 0.3
		drop.Size = UDim2.fromScale(0, size)
		drop.AnchorPoint = Vector2.new(0.5, 0.5)
		drop.Visible = false
		drop.ZIndex = 2
		local aspect = Instance.new("UIAspectRatioConstraint")
		aspect.AspectRatio = 1
		aspect.DominantAxis = Enum.DominantAxis.Height
		aspect.Parent = drop
		drop.Parent = container
		table.insert(drops, drop)

		task.spawn(function()
			task.wait((i - 1) / count * duration)
			while running do
				if Effects.motionEnabled() then
					local x = math.random()
					drop.Position = UDim2.fromScale(x, -size)
					drop.Rotation = math.random(-25, 25)
					drop.Visible = true
					local tween =
						TweenService:Create(drop, info, { Position = UDim2.fromScale(x, 1 + size) })
					active[drop] = tween
					tween:Play()
					tween.Completed:Wait()
					active[drop] = nil
					drop.Visible = false
				else
					drop.Visible = false
					task.wait(IDLE_POLL)
				end
			end
		end)
	end

	return function()
		running = false
		for _, tween in active do
			tween:Cancel()
		end
		for _, drop in drops do
			drop:Destroy()
		end
	end
end

return Effects
