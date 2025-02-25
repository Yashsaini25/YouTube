import mongoose, {Schema} from "mongoose"
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2"

const VideoSchema= new Schema({
    videoFile: {
        type: String,
        requred: true
    },

    thumbnail: {
        type:String,
        required: true
    },

    title: {
        type: String,
        required:true
    },

    description: {
        type:String, 
        required:true
    },

    duration: {
        type:Number,
        required:true
    },

    views: {
        type: Number,
        default: 0
    },

    isPublished: {
        tyoe:Boolean,
        reuired: true
    },

    owner: {
        type: Schema.Types.ObjectId,
        ref: "User"
    }
}, {timestamps: true})



VideoSchema.plugin(mongooseAggregatePaginate)
export const Video= mongoose.model("Video", VideoSchema)