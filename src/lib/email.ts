import nodemailer from 'nodemailer';

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export interface BookingEmailData {
  userEmail: string;
  userName: string;
  simulator: string;
  startTime: string;
  endTime: string;
}

export async function sendBookingConfirmation(data: BookingEmailData): Promise<boolean> {
  try {
    const { userEmail, userName, simulator, startTime, endTime } = data;

    // Format dates for display
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    const formattedDate = startDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const formattedStartTime = startDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const formattedEndTime = endDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const simulatorName = simulator.charAt(0).toUpperCase() + simulator.slice(1);

    // Email content
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background-color: #1e40af;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .content {
      background-color: #f9fafb;
      padding: 30px;
      border: 1px solid #e5e7eb;
      border-top: none;
      border-radius: 0 0 8px 8px;
    }
    .booking-details {
      background-color: white;
      padding: 20px;
      margin: 20px 0;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .label {
      font-weight: bold;
      color: #6b7280;
    }
    .value {
      color: #111827;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      color: #6b7280;
      font-size: 14px;
    }
    .important {
      background-color: #fef3c7;
      padding: 15px;
      border-radius: 8px;
      margin: 20px 0;
      border-left: 4px solid #f59e0b;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Booking Confirmation</h1>
      <p>The Cave Golf</p>
    </div>
    <div class="content">
      <p>Hi ${userName},</p>
      <p>Your golf simulator booking has been confirmed!</p>

      <div class="booking-details">
        <h2 style="margin-top: 0; color: #1e40af;">Booking Details</h2>
        <div class="detail-row">
          <span class="label">Simulator:</span>
          <span class="value">${simulatorName} Sim</span>
        </div>
        <div class="detail-row">
          <span class="label">Date:</span>
          <span class="value">${formattedDate}</span>
        </div>
        <div class="detail-row">
          <span class="label">Time:</span>
          <span class="value">${formattedStartTime} - ${formattedEndTime}</span>
        </div>
        <div class="detail-row">
          <span class="label">Duration:</span>
          <span class="value">2 hours</span>
        </div>
      </div>

      <div class="important">
        <strong>Important Reminder:</strong> Guest fees are $20 per guest. Please ensure all guests are registered when you arrive.
      </div>

      <p>If you need to cancel your booking, please log in to your account at <a href="https://golfthecave.ca">golfthecave.ca</a></p>

      <p>We look forward to seeing you!</p>

      <p style="margin-top: 30px;">
        Best regards,<br>
        <strong>The Cave Golf Team</strong>
      </p>
    </div>
    <div class="footer">
      <p>The Cave Golf<br>
      Email: golfthecave@gmail.com<br>
      Website: golfthecave.ca</p>
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `
Booking Confirmation - The Cave Golf

Hi ${userName},

Your golf simulator booking has been confirmed!

BOOKING DETAILS:
Simulator: ${simulatorName} Sim
Date: ${formattedDate}
Time: ${formattedStartTime} - ${formattedEndTime}
Duration: 2 hours

IMPORTANT REMINDER: Guest fees are $20 per guest. Please ensure all guests are registered when you arrive.

If you need to cancel your booking, please log in to your account at https://golfthecave.ca

We look forward to seeing you!

Best regards,
The Cave Golf Team

---
The Cave Golf
Email: golfthecave@gmail.com
Website: golfthecave.ca
    `;

    // Send email
    const info = await transporter.sendMail({
      from: `"The Cave Golf" <${process.env.EMAIL_FROM}>`,
      to: userEmail,
      subject: `Booking Confirmation - ${simulatorName} Sim on ${formattedDate}`,
      text: textContent,
      html: htmlContent,
    });

    console.log('Email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}
