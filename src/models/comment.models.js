import mongoose, {Schema} from "mongoose"
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2"

const commentSchema= new Schema({
    content: {
        type: String,
        requires: true
    },

    video: {
        type: Schema.Types.ObjectId,
        ref:"Video"
    },

    user: {
        type: Schema.Types.ObjectId,
        ref:"User"
    },
}, {timestamps: true})

commentSchema.plugin(mongooseAggregatePaginate)
export const Comment= mongoose.model("Comment", commentSchema)