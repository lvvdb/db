--!strict
-- Standalone mount for the shop page so it can be opened in an empty place.
--
-- In the game, ReferenceMenus' "shop" page calls ShopPage.mount into its page
-- container instead and this script is not needed.

local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")

local ShopPage = require(script.Parent.Shop.ShopPage)
local Theme = require(script.Parent.Shop.Theme)

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local gui = Instance.new("ScreenGui")
gui.Name = "HunterShop"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = true
gui.DisplayOrder = 10
gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling

local backdrop = Instance.new("Frame")
backdrop.Name = "Backdrop"
backdrop.BackgroundColor3 = Theme.colors.backdrop
backdrop.BackgroundTransparency = 0.35
backdrop.Size = UDim2.fromScale(1, 1)
backdrop.Visible = false
backdrop.Parent = gui

local openButton = Instance.new("TextButton")
openButton.Name = "OpenShop"
openButton.Text = "SHOP"
openButton.FontFace = Theme.font
openButton.TextScaled = true
openButton.TextColor3 = Theme.colors.text
openButton.BackgroundColor3 = Theme.colors.vermilion
openButton.Size = UDim2.fromOffset(120, 48)
openButton.Position = UDim2.new(0, 16, 1, -16)
openButton.AnchorPoint = Vector2.new(0, 1)
Theme.corner(openButton, Theme.radius.button)
Theme.stroke(openButton, Theme.outline.card)
openButton.Parent = gui

gui.Parent = playerGui

local handle: ShopPage.Handle? = nil

local function setOpen(open: boolean)
	backdrop.Visible = open
	if open and not handle then
		handle = ShopPage.mount(backdrop, {
			onClose = function()
				setOpen(false)
			end,
		})
	elseif not open and handle then
		handle.destroy()
		handle = nil
	end
end

openButton.Activated:Connect(function()
	setOpen(not backdrop.Visible)
end)

UserInputService.InputBegan:Connect(function(input: InputObject, processed: boolean)
	if not processed and input.KeyCode == Enum.KeyCode.M then
		setOpen(not backdrop.Visible)
	end
end)
