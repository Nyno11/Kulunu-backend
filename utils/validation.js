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

        full_name: Joi.string().required(),
        email: Joi.string().email().required(),
        password: Joi.string().required(),
        role: Joi.string().required(),
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


const travelCheck = (data) => {
    const schema = Joi.object({
        id_user: Joi.number().required(),
        title: Joi.string().valid('Mr', 'Mrs', 'Miss', 'Ms', 'Prof', 'Hon', 'Sir', 'Pst', 'Dr', 'Sen', 'Gov', 'Bar').required(),
        traveler_type: Joi.string().valid('Adult', 'Child', 'Infant').required(),
        first_name: Joi.string().min(2).max(100).required(),
        last_name: Joi.string().min(2).max(100).required(),
        middle_name: Joi.string().allow('', null),
        gender: Joi.string().valid('Male', 'Female').required(),
        date_of_birth: Joi.date().required(),
        email: Joi.string().email().required(),
        mobile_number: Joi.string().required(),
        nationality: Joi.string().required(),
        passport_number: Joi.string().required(),
        passport_expiry_date: Joi.date().required()
    });
    return schema.validate(data);
};


export default { emailCheck, changePassCheck, loginCheck, travelCheck, registerCheck, resetPassCheck, setupCheck };