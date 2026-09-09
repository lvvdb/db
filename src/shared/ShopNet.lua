--!strict
-- The one remote the shop uses.
--
-- Server -> client: a { [passKey]: true } snapshot of what the player owns.
-- Client -> server: no payload. Asks for a fresh snapshot; the server rate limits it
-- and re-checks MarketplaceService itself, so the request carries no authority.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local REMOTE_NAME = "ShopOwnership"

local ShopNet = {}

function ShopNet.getOwnershipEvent(): RemoteEvent
	if RunService:IsServer() then
		local existing = ReplicatedStorage:FindFirstChild(REMOTE_NAME)
		if existing and existing:IsA("RemoteEvent") then
			return existing
		end
		local event = Instance.new("RemoteEvent")
		event.Name = REMOTE_NAME
		event.Parent = ReplicatedStorage
		return event
	end

	local event = ReplicatedStorage:WaitForChild(REMOTE_NAME)
	assert(event:IsA("RemoteEvent"), `{REMOTE_NAME} is not a RemoteEvent`)
	return event
end

return ShopNet
