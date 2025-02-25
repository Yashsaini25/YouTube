import { asyncHandler } from "../utils/asynchandler.js";
import {ApiError} from "../utils/ApiError.js"
import { User } from "../models/user.models.js";
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";


const generateAccessandRefreshToken  = async (userId) => {
    try {
        const user = await User.findById(userId);
    
        if(!user)``
            throw new ApiError(404, "User not found")
    
        const accessToken = user.generateAccessToken()
        const RefreshToken = user.generateRefreshToken()
    
        user.refreshToken = RefreshToken
    
        user.save({validateBeforeSave: false})
    
        return {accessToken, RefreshToken}
    } catch (error) {
        throw new ApiError(500, "Failed to generate tokens")
    }
}


const registerUser=asyncHandler(async (req, res) => {
    const {fullname, email, username, password} = req.body

    if([fullname, username, email, password].some((field) => field?.trim()===""))
        throw new ApiError(400, "All fields are required")

    const existedUser = await User.findOne({
        $or: [{email}, {username}]
    })

    if(existedUser)
        throw new ApiError(409, "User with email or username already exists")

    console.warn(req.files)

    const avatarLocalPath=req.files?.avatar?.[0]
    const coverLocalPath=req.files?.coverImage?.[0]

    if(!avatarLocalPath)
        throw new ApiError(400, "Avatar file is missing")

    // const avatar = await uploadOnCloudinary(avatarLocalPath.path)

    // let coverImage=null
    // if(coverLocalPath)
    //     coverImage= await uploadOnCloudinary(coverLocalPath.path)


    let avatar;
    try{
        avatar = await uploadOnCloudinary(avatarLocalPath.path)
        console.log("Uploaded avatar", avatar)
    }
    catch(error){
        console.log("Error uploading avatar")
            throw new ApiError(500, "Failed to upload avatar")
    }

    let coverImage;
    if (coverLocalPath) {
        try{
            coverImage = await uploadOnCloudinary(coverLocalPath.path)
            console.log("Uploaded Cover Image", coverImage)
        }
        catch(error){
            console.log("Error uploading cover Image")
                throw new ApiError(500, "Failed to upload coverIamge")
        }
    }

try {
        const user = await User.create({
            fullname,
            avatar: avatar.url,
            coverImage: coverImage?.url || "",
            email,
            password,
            username: username.toLowerCase()
        })
    
        const createdUser = await User.findById(user._id).select("-password -refreshToken")
    
        if(!createdUser)
            throw new ApiError(500, "Something went wrong while registering the user")
    
        return res
            .status(201)
            .json(new ApiResponse(200, createdUser, "User registred successfully"))
} catch (error ) {
    console.log("User creation failed")

    if(avatar){
        deleteFromCloudinary(avatar.public_id)
    }

    if(coverImage)
        deleteFromCloudinary(coverImage.public_id)

    throw new ApiError(509, "Something went wrong resgistering the user and images were deleted")
}
})

const loginUser = asyncHandler( async (req, res) => {
    const {email, password} = req.body

    if([email, password].some((field) => field?.trim() === ""))
        throw new ApiError(400, "Email and password are required")

    if(!email.includes("@"))
        throw new ApiError(400, "Invalid email")

    const user = await User.findOne({
        $or: [{email}, {username: email}]
    })

    if(!user)
        throw new ApiError(404, "User not found")

    const isPasswordCorrect = await user.isPasswordCorrect(password)

    if(!isPasswordCorrect)
        throw new ApiError(401, "Invalid credentials")

    const {accessToken, refreshToken} = await generateAccessandRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(new ApiResponse(
            200,
            {user: loggedInUser, accessToken, refreshToken},
            "User logged in successfully"
        ))
})


const logoutUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id)

    if(!user)
        throw new ApiError(404, "User not found")

    user.refreshToken = ""

    user.save({validateBeforeSave: false})

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged out successfully"))
})


const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken)
        throw new ApiError(400, "Refresh token is required")

    try {
        const decoded = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)

        const user = await User.findById(decoded._id)

        if(!user)
            throw new ApiError(404, "User not found")

        if(incomingRefreshToken !== user.refreshToken)
            throw new ApiError(401, "Invalid refresh token")

        const options = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
        }

        const {accessToken, newRefreshToken} = await generateAccessandRefreshToken(user._id)

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(new ApiResponse(
                200,
                {accessToken, newRefreshToken},
                "Access token refreshed successfully"
            ))
    } catch (error) {
        throw new ApiError(500, "Something went wrong while refeshing the access token")
    }
})



const changePassword = asyncHandler(async (req, res) => {
    const {oldPassword, newPassword} = req.body

    if([oldPassword, newPassword].some((field) => field?.trim() === ""))
        throw new ApiError(400, "Old password and new password are required")

    const user = await User.findById(req.user?._id)

    if(!user)
        throw new ApiError(404, "User not found")

    const isPasswordValid = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordValid)
        throw new ApiError(401, "Invalid old password")

    user.password = newPassword
    user.refreshToken = ""

    user.save({validateBeforeSave: false})

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password changed successfully"))

})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(200, req.user, "Current user details"))
    
})

const updateUserDetails = asyncHandler(async (req, res) => {
    const {fullname, email} = req.body

    if([fullname, email].some((field) => field?.trim() === ""))
        throw new ApiError(400, "Fullname and email are required")

    const user = await User.findById(req.user._id).select("-password -refreshToken")

    if(!user)
        throw new ApiError(404, "User not found")

    user.fullname = fullname
    user.email = email

    user.save({validateBeforeSave: false})

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "User details updated successfully"))
})


const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.files?.avatar?.[0]

    if(!avatarLocalPath)
        throw new ApiError(400, "Avatar file is required")

    const user = await User.findById(req.user._id).select("-password -refreshToken")

    if(!user)
        throw new ApiError(404, "User not found")

    const avatar = await uploadOnCloudinary(avatarLocalPath.path)

    user.avatar = avatar.url
    
    user.save({validateBeforeSave: false})

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Avatar updated successfully"))
    
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.files?.coverImage?.[0]

    if(!coverImageLocalPath)
        throw new ApiError(400, "Cover Image file is required")

    const user = await User.findById(req.user._id).select("-password -refreshToken")

    if(!user)
        throw new ApiError(404, "User not found")

    const coverImage = await uploadOnCloudinary(coverImageLocalPath.path)

    user.coverImage = coverImage.url
    
    user.save({validateBeforeSave: false})

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Cover Image updated successfully"))
    
})


const getUserChannelProfile = asyncHandler(async (req, res) => {
    const username = req.params

    if(!username)
        throw new ApiError(400, "Username is required")

    const channel = await User.aggregate(
        [
            {
                $match: {
                    username: username?.toLowerCase()
                }
            },
            {
                $loopkup: {
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: "channel",
                    as: "subscribers"
                }
            },
            {
                $lookup: {
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: "subscriber",
                    as: "subscribedTo"
                }
            },
            {
                $addFields: {
                    subscribersCount: { $size: "$subscribers"},
                    subscribedToCount: { $size: "$subscribedTo"},
                    isSubscribed: {
                        $cond: {
                            if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                            then: true,
                            else: false
                        }
                    }
                }
            },
            {
                $project: {
                    fullname: 1,
                    username: 1,
                    avatar: 1,
                    coverImage: 1,
                    subscribersCount: 1,
                    subscribedToCount: 1,
                    isSubscribed: 1,
                    email: 0
                }
            }

        ]
    )

    if(!channel)
        throw new ApiError(404, "Channel not found")

    return res.status(200).json(new ApiResponse(200, channel[0], "Channel profile"))
})


const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate(
        [
            {
                $match: {_id: new mongooseTypes.ObjectId(req.user?._id)}
            },
            {
                $loopkup: {
                    from: "videos",
                    localField: "watchHistory",
                    foreignField: "_id",
                    as: "watchedVideos",
                    $pipeline: [
                        {
                            $lookup: {
                                from: "users",
                                localField: "owner",
                                foreignField: "_id",
                                as: "owner",
                                $pipeline: [
                                    {
                                        $project: {
                                            fullname: 1,
                                            username: 1,
                                            avatar: 1
                                        }
                                    }
                                ]
                            },
                        },
                        {
                            $addFields: {
                                owner: { $first: "$owner"}  
                            }
                        }
                    ]
                }
            }
        ]
    )

    if(!user)
        throw new ApiError(404, "User not found")

    return res.status(200).json(new ApiResponse(200, user[0]?.watchedVideos, "Watch history"))
})

export {registerUser, loginUser, refreshAccessToken, logoutUser, changePassword, getCurrentUser, updateUserDetails, updateUserAvatar, updateUserCoverImage, getUserChannelProfile, getWatchHistory}


