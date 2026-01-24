// // utils/sendOtp.js
// const axios = require('axios')

// async function sendOtp({ phone, otp, templateId }) {
//   try {
//     const response = await axios.post(
//       'https://www.fast2sms.com/dev/bulkV2',
//       {
//         route: 'dlt',
//         sender_id: 'CMBMPL',
//         message: templateId,              // DLT Template ID
//         variables_values: `${otp}|`,       // OTP value
//         flash: 0,
//         numbers: phone.toString()
//       },
//       {
//         headers: {
//           authorization: process.env.FAST2SMS_API_KEY,
//           'Content-Type': 'application/json'
//         }
//       }
//     )

//     return {
//       success: true,
//       data: response.data
//     }
//   } catch (error) {
//     return {
//       success: false,
//       error: error.response?.data || error.message
//     }
//   }
// }

// module.exports = sendOtp




import axios from 'axios'

const sendOtp = async ({ phone, otp, templateId }) => {
  try {
    const response = await axios.post(
      'https://www.fast2sms.com/dev/bulkV2',
      {
        route: 'dlt',
        sender_id: 'CMBMPL',
        message: templateId,
        variables_values: `${otp}|`,
        flash: 0,
        numbers: phone.toString()
      },
      {
        headers: {
          authorization: process.env.FAST2SMS_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    )

    return { success: true, data: response.data }
  } catch (err) {
    return {
      success: false,
      error: err.response?.data || err.message
    }
  }
}

export default sendOtp
