# My Shop Inventory

A free, personal product and purchase-history app made with HTML, CSS and JavaScript.

## Features
- Save product names and photos
- Record each purchase with date, rate per item, quantity and optional note
- View all previous purchase entries per product
- Edit product details and past purchase entries
- Search products
- Export and restore JSON backups
- Responsive layout and basic PWA install/offline support

## Run in VS Code
1. Extract this folder.
2. Open the `my_shop_inventory` folder in VS Code.
3. Install the **Live Server** extension if you do not have it.
4. Right-click `index.html` and select **Open with Live Server**.
5. Your browser should open a local address such as `http://127.0.0.1:5500`.

IndexedDB needs a browser origin. Do not open the HTML file by double-clicking it as a `file://` URL.

## Use on mobile and computer
- For an installable app, host these files on a free HTTPS static host (for example GitHub Pages) and open the published URL on each device.
- On supported browsers, use the browser menu and choose **Install app** or **Add to Home Screen**.
- Each device has its own local database. Export a JSON backup on one device, transfer it to the other, then use **Restore backup** there. It does not automatically sync.
- Keep backups safe. Clearing browser/site data can remove local records.

## Important
This is a local purchase register, not a stock accounting system. It records purchase quantities and cost history but does not yet calculate remaining stock, sales, or profit.
