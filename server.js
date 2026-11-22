require("dotenv").config();

const express = require("express");
const cors = require("cors");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const app = express();

app.use(cors({
origin: process.env.FRONTEND_URL
? process.env.FRONTEND_URL.split(",")
: true
}));

app.use(express.json());

const PORT = process.env.PORT || 3000;

const razorpay = new Razorpay({
key_id: process.env.RAZORPAY_KEY_ID,
key_secret: process.env.RAZORPAY_KEY_SECRET
});

app.get("/", (req, res) => {
res.send("HN ENTERPRISES Payment Backend is Running!");
});

// Create Razorpay Order
app.post("/create-order", async (req, res) => {
try {
const amount = Number(req.body.amount);

if (!Number.isInteger(amount) || amount < 100) {
  return res.status(400).json({
    success: false,
    message: "Invalid payment amount"
  });
}

const order = await razorpay.orders.create({
  amount: amount,
  currency: "INR",
  receipt: "HN_" + Date.now()
});

res.json({
  success: true,
  orderId: order.id,
  amount: order.amount,
  currency: order.currency,
  keyId: process.env.RAZORPAY_KEY_ID
});

} catch (error) {
console.error("Create order error:", error);
res.status(500).json({
success: false,
message: "Unable to create payment order"
});
}
});

// Verify Razorpay Payment
app.post("/verify-payment", (req, res) => {
try {
const {
razorpay_order_id,
razorpay_payment_id,
razorpay_signature
} = req.body;

if (
  !razorpay_order_id ||
  !razorpay_payment_id ||
  !razorpay_signature
) {
  return res.status(400).json({
    success: false,
    message: "Payment details are missing"
  });
}

const body = razorpay_order_id + "|" + razorpay_payment_id;

const expectedSignature = crypto
  .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
  .update(body)
  .digest("hex");

const isValid = crypto.timingSafeEqual(
  Buffer.from(expectedSignature, "hex"),
  Buffer.from(razorpay_signature, "hex")
);

if (!isValid) {
  return res.status(400).json({
    success: false,
    message: "Payment verification failed"
  });
}

res.json({
  success: true,
  message: "Payment verified successfully",
  paymentId: razorpay_payment_id
});

} catch (error) {
console.error("Verification error:", error);
res.status(500).json({
success: false,
message: "Payment verification error"
});
}
});

app.listen(PORT, () => {
console.log("HN Payment Backend running on port ${PORT}");
});
