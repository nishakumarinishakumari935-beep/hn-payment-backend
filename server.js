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

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});


/* HOME ROUTE */

app.get("/", (req, res) => {

    res.send("HN ENTERPRISES Payment Backend is Running!");

});


/* CREATE RAZORPAY ORDER */

app.post("/create-order", async (req, res) => {

    try {

        const quantity = Number(req.body.quantity);
        const amount = Number(req.body.amount);

        if (
            !Number.isSafeInteger(quantity) ||
            quantity < MINIMUM_QUANTITY
        ) {

            return res.status(400).json({

                success: false,

                message: "Minimum order quantity is 10 packets."

            });

        }

        if (
            !Number.isSafeInteger(amount) ||
            amount < 100
        ) {

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


/* VERIFY RAZORPAY PAYMENT */

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


/* START SERVER */

app.listen(PORT, () => {

    console.log(
        `HN Payment Backend running on port ${PORT}`
    );

});
