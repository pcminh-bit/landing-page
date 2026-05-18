/** Catalog sản phẩm số — slug dùng trong URL và API */
const DIGITAL_PRODUCTS = {
  "linkedin-easy-posting-machine": {
    slug: "linkedin-easy-posting-machine",
    name: "LinkedIn Easy Posting Machine",
    tagline: "5 AI Skills — từ brainstorm đến post sẵn đăng trong 27 phút",
    price: 497_000,
    zipFile: "linkedin-easy-posting-machine.zip",
    paths: {
      landing: "/san-pham/linkedin-easy-posting-machine/",
      checkout: "/san-pham/linkedin-easy-posting-machine/checkout",
      thanks: "/san-pham/linkedin-easy-posting-machine/cam-on",
    },
  },
};

function getDigitalProduct(slug) {
  return DIGITAL_PRODUCTS[String(slug || "").trim()] || null;
}

function listDigitalProducts() {
  return Object.values(DIGITAL_PRODUCTS);
}

module.exports = {
  DIGITAL_PRODUCTS,
  getDigitalProduct,
  listDigitalProducts,
};
