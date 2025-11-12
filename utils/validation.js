import Joi from 'joi';



function emailCheck(reqbody) {
    const schema = Joi.object({


        email: Joi.string().email().required(),
    }).options({ allowUnknown: true });

    return schema.validate(reqbody, {
        abortEarly: false
    });
}


function changePassCheck(reqbody) {
    const schema = Joi.object({
        oldpassword: Joi.string().required(),
        newpassword: Joi.string().required(),
        newpasswordrepeat: Joi.string().required()
    }).options({ allowUnknown: true });

    return schema.validate(reqbody, {
        abortEarly: false
    });
}

function loginCheck(reqbody) {
    const schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required()
    }).options({ allowUnknown: true });

    return schema.validate(reqbody, {
        abortEarly: false
    });
}

function registerCheck(reqbody) {
    const schema = Joi.object({

        name: Joi.string().required(),
        email: Joi.string().email().required(),
        password: Joi.string().required(),
        usertype: Joi.string().required(),
        handle: Joi.string().required(),
    }).options({ allowUnknown: true });

    return schema.validate(reqbody, {
        abortEarly: false
    });
}

function resetPassCheck(reqbody) {
    const schema = Joi.object({

        token: Joi.string().required(),
        newpassword: Joi.string().required(),
        newpasswordrepeat: Joi.string().required(),
    }).options({ allowUnknown: true });

    return schema.validate(reqbody, {
        abortEarly: false
    });
}

function setupCheck(reqbody) {
    const schema = Joi.object({

        dateofbirth: Joi.date().required(),
        about: Joi.string().required(),
        sportsid: Joi.required(),

    }).options({ allowUnknown: true });

    return schema.validate(reqbody, {
        abortEarly: false
    });
}

export default { emailCheck, changePassCheck, loginCheck, registerCheck, resetPassCheck, setupCheck };