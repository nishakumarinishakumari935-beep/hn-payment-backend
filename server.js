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
const MINIMUM_QUANTITY = 10;

// RAZORPAY CONFIGURATION

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});


// MOBILE NUMBER FORMAT

function formatMobile(mobile) {
    const number = String(mobile || "").replace(/\D/g, "");

    if (/^[6-9]\d{9}$/.test(number)) {
        return "91" + number;
    }

    if (/^91[6-9]\d{9}$/.test(number)) {
        return number;
    }

    return null;
}


// HOME ROUTE

app.get("/", (req, res) => {
    res.send("HN ENTERPRISES Payment Backend is Running!");
});


// MSG91 SEND OTP

app.post("/send-otp", async (req, res) => {
    try {
        const mobile = formatMobile(req.body.mobile);

        if (!mobile) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid Indian mobile number."
            });
        }

        if (!process.env.MSG91_AUTHKEY ||
            !process.env.MSG91_TEMPLATE_ID) {
            return res.status(500).json({
                success: false,
                message: "MSG91 configuration is missing."
            });
        }

        const params = new URLSearchParams({
            template_id: process.env.MSG91_TEMPLATE_ID,
            mobile: mobile,
            otp_length: "6",
            otp_expiry: "5"
        });

        const response = await fetch(
            "https://control.msg91.com/api/v5/otp?" + params,
            {
                method: "POST",
                headers: {
                    authkey: process.env.MSG91_AUTHKEY,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({})
            }
        );

        const result = await response.json();

        if (!response.ok || result.type !== "success") {
            console.error("MSG91 Send OTP Error:", result);

            return res.status(400).json({
                success: false,
                message: "Unable to send OTP. Please check MSG91 settings."
            });
        }

        res.json({
            success: true,
            message: "OTP sent successfully."
        });

    } catch (error) {
        console.error("Send OTP Error:", error);

        res.status(500).json({
            success: false,
            message: "OTP sending failed."
        });
    }
});


// MSG91 VERIFY OTP

app.post("/verify-otp", async (req, res) => {
    try {
        const mobile = formatMobile(req.body.mobile);
        const otp = String(req.body.otp || "");

        if (!mobile || !/^\d{6}$/.test(otp)) {
            return res.status(400).json({
                success: false,
                message: "Invalid mobile number or OTP."
            });
        }

        if (!process.env.MSG91_AUTHKEY) {
            return res.status(500).json({
                success: false,
                message: "MSG91 configuration is missing."
            });
        }

        const params = new URLSearchParams({
            mobile: mobile,
            otp: otp
        });

        const response = await fetch(
            "https://control.msg91.com/api/v5/otp/verify?" + params,
            {
                method: "GET",
                headers: {
                    authkey: process.env.MSG91_AUTHKEY
                }
            }
        );

        const result = await response.json();

        if (!response.ok || result.type !== "success") {
            return res.status(400).json({
                success: false,
                message: "Incorrect or expired OTP."
            });
        }

        res.json({
            success: true,
            message: "OTP verified successfully."
        });

    } catch (error) {
        console.error("Verify OTP Error:", error);

        res.status(500).json({
            success: false,
            message: "OTP verification failed."
        });
    }
});


// CREATE RAZORPAY ORDER

app.post("/create-order", async (req, res) => {
    try {
        const quantity = Number(req.body.quantity);
        const amount = Number(req.body.amount);

        if (!Number.isSafeInteger(quantity) ||
            quantity < MINIMUM_QUANTITY) {
            return res.status(400).json({
                success: false,
                message: "Minimum order quantity is 10 packets."
            });
        }

        if (!Number.isSafeInteger(amount) || amount < 100) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment amount."
            });
        }

        const order = await razorpay.orders.create({
            amount: amount,
            currency: "INR",
            receipt: "HN_" + Date.now(),
            notes: {
                quantity: String(quantity),
                company: "HN ENTERPRISES"
            }
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
            message: "Unable to create payment order."
        });
    }
});


// VERIFY RAZORPAY PAYMENT

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
            !razorpay_signature ||
            !/^[a-f0-9]{64}$/i.test(razorpay_signature)
        ) {
            return res.status(400).json({
                success: false,
                message: "Payment details are missing or invalid."
            });
        }

        const body =
            razorpay_order_id + "|" + razorpay_payment_id;

        const expectedSignature = crypto
            .createHmac(
                "sha256",
                process.env.RAZORPAY_KEY_SECRET
            )
            .update(body)
            .digest("hex");

        const isValid = crypto.timingSafeEqual(
            Buffer.from(expectedSignature, "hex"),
            Buffer.from(razorpay_signature, "hex")
        );

        if (!isValid) {
            return res.status(400).json({
                success: false,
                message: "Payment verification failed."
            });
        }

        res.json({
            success: true,
            message: "Payment verified successfully.",
            paymentId: razorpay_payment_id
        });

    } catch (error) {
        console.error("Verification error:", error);

        res.status(500).json({
            success: false,
            message: "Payment verification error."
        });
    }
});


// START SERVER

app.listen(PORT, () => {
    console.log(`HN Payment Backend running on port ${PORT}`);
});
