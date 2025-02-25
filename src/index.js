import dotenv from "dotenv"
import {app} from "./app.js"
import connectDB from "./db/index.js"

dotenv.config()
const PORT=process.env.PORT || 7002

connectDB()
.then(
    app.listen(PORT, () => {
    console.log(`Server is listening at the port ${PORT}`)
}))
.catch((err) => {
    console.log("MongoDB connection error")
})