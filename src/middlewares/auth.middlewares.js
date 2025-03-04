import jwt from "jsonwebtoken"
import { User } from "../models/user.models.js"
import { ApiError } from "../utils/ApiError.js"
import { asyncHandler } from "../utils/asynchandler.js"

export const verifyJWT = asyncHandler(async (req, _, next) => {
    const token = req.cookies.accessToekn || req.header.authorization?.split(" ")[1]

    if(!token)
        throw new ApiError(401, "Unauthorized")

    try {
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

        const user = await User.findById(decodedToken._id).select("-password -refreshToken")

        if(!user)
            throw new ApiError(404, "User not found")

        req.user = user
        next()

    } catch (error) {
        throw new ApiError(401, error?.message || "Unauthorized")
    }
})
