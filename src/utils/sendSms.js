import axios from 'axios'

const sendSms = async ({ to, newUserName, templateId }) => {
  try {
    const response = await axios.post(
      'https://www.fast2sms.com/dev/bulkV2',
      {
        route: 'dlt',
        sender_id: 'CMBMPL',
        message: templateId,
        variables_values: `${newUserName}|`,
        flash: 0,
        numbers: to.toString()
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

export default sendSms
