# Hunter Exam shop page

Gamepass shop panel for the Hunter x Hunter game, built to the phox_dev reference: rainbow header with a bouncy pixel "SHOP", a GAMEPASSES label, one wide gold VIP card with BUY and a tilted price, then three equal small cards. Everything is UICorner, UIStroke and UIGradient; only the icons, the tile textures and the click sound are baked assets.

Strict Luau, tabs, Rojo layout. The only purchase path is `MarketplaceService:PromptGamePassPurchase`, and the server never trusts a client claim of ownership.

## Layout

```
src/
  shared/ShopConfig.lua        catalogue: passes, copy, colours, asset ids
  shared/ShopNet.lua           the one RemoteEvent (ownership snapshots)
  server/GamepassService.lua   ownership authority + perk grants
  server/GamepassServer.server.lua
  client/Shop/Theme.lua        palette, pixel font, corner / stroke / gradient / text builders
  client/Shop/Effects.lua      hover + press scale, title gleam, crest rain, motion toggle
  client/Shop/ShopPage.lua     the page itself, ShopPage.mount(parent, deps)
  client/ShopController.client.lua   standalone mount for an empty place (M key or the SHOP button)
```

## Wiring it into ReferenceMenus

Mount into the "shop" page container and destroy on close. Mounting starts the gleam and rain loops, destroying stops them, so mount when the page opens rather than at boot.

```lua
local ShopPage = require(path.to.Shop.ShopPage)

local handle = ShopPage.mount(pageContainer, {
	onClose = function()
		ReferenceMenus.close()
	end,
	motionEnabled = function()
		return Settings.get("motion")
	end,
})

-- later
handle.destroy()
```

`motionEnabled` is read every cycle. Without it the platform reduce-motion flag decides. `handle.setOwned({ vip = true })` is there if the menu already holds ownership state; otherwise the page asks the server itself on mount.

Server side, `GamepassServer.server.lua` starts the service. Perks default to attributes on the Player (`GoldLicenceFrame`, `VIPTag`, `KonPelts = 3`, `OutfitSlots = 8`, `TavernAccess`). Replace any of them before `start()`:

```lua
GamepassService.setPerkHandler("konPelts", function(player, perk)
	Inventory.grantOnce(player, "konPelt", perk.amount or 0)
end)
```

The service never persists anything. One-off grants like the pelts need the game's data store in the handler.

## Behaviours

Hover tweens cards and BUY to scale 1.08 over 0.12 s (Quad out), press to 0.9 with the click sound. Touch only gets the press state. Gleam sweeps a white band across fill and outline of "SHOP" (letter to letter) and every card title, 0.8 s per sweep, 2 s pause. Rain drops 12 crest sprites through the featured card over 6 s on a loop, clipped to the card. Gleam and rain pause while motion is off.

Panel is 1000 x 620 on desktop and scales to width on phones with the three small cards still in one row. Close and BUY carry a 48 px minimum size.

## Fill in before shipping

| What | Where |
| --- | --- |
| Gamepass ids (all 0 now; id 0 never prompts and never grants) | `ShopConfig.lua`, `gamepassId` per pass |
| Icons: licence card, crest, Kon, wardrobe, tavern key | `ShopConfig.assets` and each pass `icon` |
| Textures: diamond lattice, header triangle tile, crest watermark, rain crest sprite | `ShopConfig.assets` |
| Click sound | `ShopConfig.assets.clickSound` |

Live prices come from `GetProductInfo` once the ids exist; `fallbackPrice` shows until then.

## Checks

```
stylua --check src
rojo sourcemap default.project.json -o sourcemap.json
curl -sSL -o globalTypes.d.luau https://raw.githubusercontent.com/JohnnyMorganz/luau-lsp/main/scripts/globalTypes.d.luau
luau-lsp analyze --definitions=globalTypes.d.luau --sourcemap=sourcemap.json src
```
