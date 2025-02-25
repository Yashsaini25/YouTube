class ApiError extends Error {
    constructor(statusCode, message="Something went wrong", errors=[], stack=""){
        super(message)
        this.statusCode=statusCode
        this.data=null
        this.sucess=false
        this.errors=errors
        this.message=this.message

        if(stack)
            this.stack=stack
        else Error.captureStackTrace(this, this.constructor)
    }
}

export {ApiError}