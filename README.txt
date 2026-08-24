PRISHAA FINAL - DIRECT FILE MODE

This is the final direct-open version.

IMPORTANT:
Do NOT use START_PRISHAA.bat.
Do NOT use fetch().
Open:
  admin/index.html
  user/index.html

Admin -> View Store is guaranteed to pass the current catalogue directly to the User Store using the URL hash.
This means an image selected in Admin is shown in User Store without any server or fetch.

Admin:
- Choose Image only
- PNG/JPG/JPEG/WEBP
- Automatic compression
- Add/Edit/Delete
- Orders
- View Store

User:
- Catalogue
- Product details
- Cart
- Checkout
- Tracking

The supplied Purple Chaniya Choli image is embedded.
There are 10 preloaded products.


LATEST UPDATE: Admin order cards now show ordered products, quantities, line totals, delivery address, city, state, pincode, customer, and phone.

LATEST CHANGE:
After checkout, the User side now shows the physical visit location:
Nicolas 4
Super Tech Czar
Omicron - 1
Greater Noida

A Call / Contact Us button is present, but the phone number is currently a placeholder
(YOUR_NUMBER) because no contact number was provided yet.


CONTACT NUMBER: not provided yet, so the Call / Contact button still uses YOUR_NUMBER as a placeholder. No number was invented.

LATEST CHANGE:
Contact number: 9752347717

Checkout confirmation now shows:
Nicolas 4
Super Tech Czar
Omicron - 1
Greater Noida

Users can click the contact number to call directly.
The same contact/address information is also shown on the user-facing website description/footer.

LATEST CHANGE:
After the user successfully confirms an order at checkout, the contact/visit message now opens as a popup overlay.
The popup contains:
9752347717
Nicolas 4
Super Tech Czar
Omicron - 1
Greater Noida
and a Call us directly button.

LATEST FOOTER UPDATE: Removed duplicate contact number from footer and added a small handwritten-style 'by Priya & Shweta' signature.

LATEST UI UPDATE:
Visit/contact information and brand identity are now combined in one single block:
1. Address + contact
2. PRISHAA
3. WOMEN'S COLLECTION
4. Let your elegance speak for you
5. by Priya & Shweta

LATEST UI FIX: Removed duplicate address/contact block. Kept one combined section and repeated PRISHAA in matching handwritten style beneath WOMEN'S COLLECTION.


LATEST FIX: Restored the single combined address/contact + PRISHAA brand block and removed only the duplicate address/contact block above it. The small PRISHAA hero label remains removed.

LATEST FIX: Removed the upper duplicate address/contact and removed the duplicate PRISHAA text. One handwritten PRISHAA remains in the combined brand block.

LATEST FIX: Removed the remaining top standalone address section. The rest of the PRISHAA design is unchanged.

LATEST FIX: Removed the remaining duplicate standalone address section shown between the product grid and the brand block. The intended combined brand/contact block is unchanged.


LATEST FIX: Restored the physical visit address inside the checkout confirmation popup only. The standalone address section on the page remains removed.


LATEST UI UPDATE: PRISHAA main brand name is now in a softer, more natural handwritten font.


LATEST UI UPDATE: PRISHAA main brand name now matches the uploaded clean bold sans-serif reference style, with a compact sans-serif WOMEN'S COLLECTION subtitle.

LATEST CHANGE: Removed the entire dark PRISHAA footer section from the user-facing pages. Everything else remains unchanged.

LATEST UI UPDATE: Reversed the combined Visit/Contact and PRISHAA brand columns: PRISHAA brand is now on the left, address/contact on the right.

LATEST UI UPDATE: Removed Track Order button and its unused modal/handler from the user panel.

LATEST UI UPDATE: Restored the original single hero image; slideshow removed.

LATEST UPDATE: Added Delete Order button in Admin > Customer Orders with a confirmation prompt.


FIXED: Delete Order is visibly rendered beside the order status dropdown for every order. Confirmation is shown before deletion.

LATEST UPDATE: Added an optional Length field to Admin Add/Edit Product. Leaving it blank is allowed; when provided, it is saved and shown in product details.


ADMIN AUTHENTICATION:
Set ADMIN_PASSWORD and ADMIN_SESSION_SECRET in .env locally and in Render Environment Variables. The /admin/ page requires the password; admin API writes and order viewing are protected server-side.
