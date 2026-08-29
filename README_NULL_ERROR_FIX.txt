FIX FOR: Cannot set properties of null (setting 'innerHTML')

Cause:
The previous generated user page called renderCart() on startup, but the page
does not contain #cartItems / #cartTotal. JavaScript crashed and the storefront
showed "Store could not load".

Fixed:
- cart rendering now checks elements before setting innerHTML
- checkout form and checkout summary are safely guarded
- removed stale coupon reference
- removed the 5-second forced reload loop
- product-specific offers remain
- no global 20% homepage offer
