// lib/email.ts
import nodemailer from 'nodemailer';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

interface TenantCredentials {
  to: string;
  firstName: string;
  lastName: string;
  unitNumber: string;
  username: string;
  password: string;
  rulesDocumentUrl?: string;
  contractDocumentUrl?: string;
}

// Create transporter function
const createTransporter = () => {
  const config: EmailConfig = {
    host: process.env.EMAIL_HOST!,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER!,
      pass: process.env.EMAIL_PASSWORD!,
    },
  };

  return nodemailer.createTransport(config);
};

// Function to download PDF from URL
const downloadPDF = async (url: string): Promise<Buffer> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('Error downloading PDF:', error);
    throw error;
  }
};

// Send tenant credentials email
export const sendTenantCredentials = async (
  credentials: TenantCredentials
): Promise<{ success: boolean; error?: string }> => {
  try {
    const transporter = createTransporter();

    // Prepare attachments
    const attachments = [];

    // Download and attach rules document
    if (credentials.rulesDocumentUrl) {
      try {
        const rulesPDF = await downloadPDF(credentials.rulesDocumentUrl);
        attachments.push({
          filename: `Panuntunan_at_Regulasyon_${credentials.firstName}_${credentials.lastName}.pdf`,
          content: rulesPDF,
          contentType: 'application/pdf',
        });
      } catch (error) {
        console.error('Error downloading rules PDF:', error);
      }
    }

    // Download and attach contract document
    if (credentials.contractDocumentUrl) {
      try {
        const contractPDF = await downloadPDF(credentials.contractDocumentUrl);
        attachments.push({
          filename: `Kasunduan_sa_Paupa_${credentials.firstName}_${credentials.lastName}.pdf`,
          content: contractPDF,
          contentType: 'application/pdf',
        });
      } catch (error) {
        console.error('Error downloading contract PDF:', error);
      }
    }

    const hasDocuments = attachments.length > 0;

    const emailTemplate = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 700px; margin: 0 auto; padding: 20px; }
        .header { background: #574964; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .credentials { background: white; padding: 20px; border-radius: 6px; border-left: 4px solid #574964; margin: 20px 0; }
        .field { margin-bottom: 15px; }
        .label { font-weight: bold; color: #574964; display: block; margin-bottom: 5px; }
        .value { font-family: monospace; background: #f3f4f6; padding: 8px 12px; border-radius: 4px; display: inline-block; }
        .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; }
        .documents { background: #e0f2fe; border: 1px solid #0ea5e9; padding: 15px; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to Rodriguez Properties!</h1>
        </div>
        <div class="content">
            <p>Hello ${credentials.firstName} ${credentials.lastName},</p>
            <p>Your tenant account has been successfully created. Here are your login credentials:</p>
            
            <div class="credentials">
                <div class="field">
                    <span class="label">Username/Email:</span>
                    <span class="value">${credentials.username}</span>
                </div>
                <div class="field">
                    <span class="label">Password:</span>
                    <span class="value">${credentials.password}</span>
                </div>
                <div class="field">
                    <span class="label">Unit Number:</span>
                    <span class="value">${credentials.unitNumber}</span>
                </div>
            </div>

            ${
              hasDocuments
                ? `
            <div class="documents">
                <strong>📎 Important Documents Attached:</strong>
                <p>Your signed tenancy documents are attached to this email:</p>
                <ul>
                    ${credentials.rulesDocumentUrl ? '<li>• <strong>Panuntunan at Regulasyon</strong> (Rules and Regulations)</li>' : ''}
                    ${credentials.contractDocumentUrl ? '<li>• <strong>Kasunduan sa Paupa</strong> (Lease Agreement)</li>' : ''}
                </ul>
                <p>Please save these documents for your records and reference.</p>
            </div>
            `
                : ''
            }

            <div class="warning">
                <strong>Important Security Notice:</strong>
                <p>For your security, please change your password immediately after logging in for the first time.</p>
            </div>

            <p>You can access your account through our Rodriguez Properties application.</p>
            
            <div class="footer">
                <p>If you have any questions, please contact the property management.</p>
                <p>This is an automated message, please do not reply to this email.</p>
            </div>
        </div>
    </div>
</body>
</html>
    `;

    const mailOptions = {
      from: {
        name: process.env.EMAIL_FROM_NAME || 'Rodriguez Properties Management',
        address: process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER!,
      },
      to: credentials.to,
      subject: `Your Tenant Account Credentials - Unit ${credentials.unitNumber}`,
      html: emailTemplate,
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    const result = await transporter.sendMail(mailOptions);

    console.log('✅ Email sent successfully:', {
      to: credentials.to,
      messageId: result.messageId,
      attachments: attachments.length,
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred while sending email',
    };
  }
};

// Billing Reminder Email Interface
interface BillingReminderEmail {
  to: string;
  name: string;
  role: 'tenant' | 'landlord';
  billingType: 'overdue' | 'due_today' | 'due_soon' | 'upcoming';
  billingAmount: number;
  dueDate: string;
  daysUntilDue?: number;
  tenantName?: string; // For landlord emails
  unitNumber?: string;
}

// Send billing reminder email
export const sendBillingReminderEmail = async (
  data: BillingReminderEmail
): Promise<{ success: boolean; error?: string }> => {
  try {
    const transporter = createTransporter();

    // Determine urgency level and styling
    const urgencyConfig = {
      overdue: {
        color: '#dc2626',
        bgColor: '#fee2e2',
        borderColor: '#ef4444',
        icon: '⚠️',
        priorityEn: 'URGENT - OVERDUE',
        priorityTl: 'KAGYAT - LAMPAS NA SA TAKDANG ARAW'
      },
      due_today: {
        color: '#ea580c',
        bgColor: '#ffedd5',
        borderColor: '#f97316',
        icon: '🔔',
        priorityEn: 'DUE TODAY',
        priorityTl: 'DAPAT BAYARAN NGAYON'
      },
      due_soon: {
        color: '#d97706',
        bgColor: '#fef3c7',
        borderColor: '#f59e0b',
        icon: '📅',
        priorityEn: 'DUE SOON',
        priorityTl: 'MALAPIT NANG TAKDANG ARAW'
      },
      upcoming: {
        color: '#2563eb',
        bgColor: '#dbeafe',
        borderColor: '#3b82f6',
        icon: '📌',
        priorityEn: 'UPCOMING',
        priorityTl: 'PAPARATING'
      }
    };

    const config = urgencyConfig[data.billingType];

    // Generate content based on role
    const isTenant = data.role === 'tenant';
    
    // English content
    let mainMessageEn = '';
    let actionMessageEn = '';
    
    // Tagalog content
    let mainMessageTl = '';
    let actionMessageTl = '';

    if (isTenant) {
      // Tenant messages
      if (data.billingType === 'overdue') {
        mainMessageEn = `Your rent payment of <strong>₱${data.billingAmount.toLocaleString()}</strong> is now <strong style="color: ${config.color}">OVERDUE</strong>. The payment was due on <strong>${data.dueDate}</strong>.`;
        actionMessageEn = 'Please settle this payment immediately to avoid any penalties or disruption to your tenancy.';
        
        mainMessageTl = `Ang inyong bayad sa upa na nagkakahalaga ng <strong>₱${data.billingAmount.toLocaleString()}</strong> ay <strong style="color: ${config.color}">LAMPAS NA SA TAKDANG ARAW</strong>. Ang takdang araw ng bayad ay <strong>${data.dueDate}</strong>.`;
        actionMessageTl = 'Mangyaring bayaran ito kaagad upang maiwasan ang anumang multa o abala sa inyong pananahanan.';
      } else if (data.billingType === 'due_today') {
        mainMessageEn = `Your rent payment of <strong>₱${data.billingAmount.toLocaleString()}</strong> is <strong style="color: ${config.color}">DUE TODAY</strong> (${data.dueDate}).`;
        actionMessageEn = 'Please process your payment today to avoid late fees.';
        
        mainMessageTl = `Ang inyong bayad sa upa na nagkakahalaga ng <strong>₱${data.billingAmount.toLocaleString()}</strong> ay <strong style="color: ${config.color}">DAPAT BAYARAN NGAYON</strong> (${data.dueDate}).`;
        actionMessageTl = 'Mangyaring magbayad ngayong araw upang maiwasan ang late fees.';
      } else if (data.billingType === 'due_soon') {
        mainMessageEn = `Your rent payment of <strong>₱${data.billingAmount.toLocaleString()}</strong> is due in <strong style="color: ${config.color}">${data.daysUntilDue} ${data.daysUntilDue === 1 ? 'day' : 'days'}</strong> (${data.dueDate}).`;
        actionMessageEn = 'Please prepare your payment to ensure timely settlement.';
        
        mainMessageTl = `Ang inyong bayad sa upa na nagkakahalaga ng <strong>₱${data.billingAmount.toLocaleString()}</strong> ay dapat bayaran sa loob ng <strong style="color: ${config.color}">${data.daysUntilDue} ${data.daysUntilDue === 1 ? 'araw' : 'mga araw'}</strong> (${data.dueDate}).`;
        actionMessageTl = 'Mangyaring ihanda ang inyong bayad upang masiguro ang tamang oras ng pagbabayad.';
      } else {
        mainMessageEn = `This is a reminder that your rent payment of <strong>₱${data.billingAmount.toLocaleString()}</strong> is due in <strong style="color: ${config.color}">${data.daysUntilDue} days</strong> (${data.dueDate}).`;
        actionMessageEn = 'You can prepare your payment in advance for convenience.';
        
        mainMessageTl = `Ito ay paalala na ang inyong bayad sa upa na nagkakahalaga ng <strong>₱${data.billingAmount.toLocaleString()}</strong> ay dapat bayaran sa loob ng <strong style="color: ${config.color}">${data.daysUntilDue} araw</strong> (${data.dueDate}).`;
        actionMessageTl = 'Maaari ninyong ihanda ang inyong bayad nang maaga para sa inyong kaginhawahan.';
      }
    } else {
      // Landlord messages
      const tenantInfo = data.tenantName ? `<strong>${data.tenantName}</strong>${data.unitNumber ? ` (Unit ${data.unitNumber})` : ''}` : 'A tenant';
      const tenantInfoTl = data.tenantName ? `si/ang <strong>${data.tenantName}</strong>${data.unitNumber ? ` (Yunit ${data.unitNumber})` : ''}` : 'Ang isang tenant';
      
      if (data.billingType === 'overdue') {
        mainMessageEn = `${tenantInfo} has an <strong style="color: ${config.color}">OVERDUE</strong> rent payment of <strong>₱${data.billingAmount.toLocaleString()}</strong>. The payment was due on <strong>${data.dueDate}</strong>.`;
        actionMessageEn = 'You may want to follow up with the tenant regarding this overdue payment.';
        
        mainMessageTl = `${tenantInfoTl} ay may bayad sa upa na <strong style="color: ${config.color}">LAMPAS NA SA TAKDANG ARAW</strong> na nagkakahalaga ng <strong>₱${data.billingAmount.toLocaleString()}</strong>. Ang takdang araw ng bayad ay <strong>${data.dueDate}</strong>.`;
        actionMessageTl = 'Maaari ninyong sundan ang tenant tungkol sa bayad na lampas na sa takdang araw.';
      } else if (data.billingType === 'due_today') {
        mainMessageEn = `${tenantInfo} has a rent payment of <strong>₱${data.billingAmount.toLocaleString()}</strong> that is <strong style="color: ${config.color}">DUE TODAY</strong> (${data.dueDate}).`;
        actionMessageEn = 'This is a reminder to monitor the payment status.';
        
        mainMessageTl = `${tenantInfoTl} ay may bayad sa upa na nagkakahalaga ng <strong>₱${data.billingAmount.toLocaleString()}</strong> na <strong style="color: ${config.color}">DAPAT BAYARAN NGAYON</strong> (${data.dueDate}).`;
        actionMessageTl = 'Ito ay paalala upang subaybayan ang katayuan ng bayad.';
      } else if (data.billingType === 'due_soon') {
        mainMessageEn = `${tenantInfo} has a rent payment of <strong>₱${data.billingAmount.toLocaleString()}</strong> due in <strong style="color: ${config.color}">${data.daysUntilDue} ${data.daysUntilDue === 1 ? 'day' : 'days'}</strong> (${data.dueDate}).`;
        actionMessageEn = 'The tenant has been notified about this upcoming payment.';
        
        mainMessageTl = `${tenantInfoTl} ay may bayad sa upa na nagkakahalaga ng <strong>₱${data.billingAmount.toLocaleString()}</strong> na dapat bayaran sa loob ng <strong style="color: ${config.color}">${data.daysUntilDue} ${data.daysUntilDue === 1 ? 'araw' : 'mga araw'}</strong> (${data.dueDate}).`;
        actionMessageTl = 'Ang tenant ay naabisuhan na tungkol sa paparating na bayad.';
      } else {
        mainMessageEn = `${tenantInfo} has a rent payment of <strong>₱${data.billingAmount.toLocaleString()}</strong> due in <strong style="color: ${config.color}">${data.daysUntilDue} days</strong> (${data.dueDate}).`;
        actionMessageEn = 'This is an advance notification for your records.';
        
        mainMessageTl = `${tenantInfoTl} ay may bayad sa upa na nagkakahalaga ng <strong>₱${data.billingAmount.toLocaleString()}</strong> na dapat bayaran sa loob ng <strong style="color: ${config.color}">${data.daysUntilDue} araw</strong> (${data.dueDate}).`;
        actionMessageTl = 'Ito ay paunang abiso para sa inyong talaan.';
      }
    }

    const emailTemplate = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 700px; margin: 0 auto; padding: 20px; }
        .header { background: #574964; color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 24px; }
        .priority-badge { 
            background: ${config.bgColor}; 
            color: ${config.color}; 
            border: 2px solid ${config.borderColor}; 
            padding: 15px 20px; 
            text-align: center; 
            font-size: 18px; 
            font-weight: bold; 
            margin: 20px 0;
            border-radius: 6px;
        }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .greeting { font-size: 16px; margin-bottom: 20px; }
        .message-box { 
            background: white; 
            padding: 25px; 
            border-radius: 6px; 
            border-left: 5px solid ${config.borderColor}; 
            margin: 20px 0; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .amount-highlight { 
            background: #f3f4f6; 
            padding: 15px; 
            border-radius: 4px; 
            font-size: 18px; 
            text-align: center; 
            margin: 15px 0;
            border: 1px solid #e5e7eb;
        }
        .action-box { 
            background: ${config.bgColor}; 
            border: 1px solid ${config.borderColor}; 
            padding: 20px; 
            border-radius: 6px; 
            margin: 20px 0; 
        }
        .divider { 
            border-top: 2px solid #e5e7eb; 
            margin: 30px 0; 
        }
        .tagalog-section { 
            background: #f8fafc; 
            padding: 25px; 
            border-radius: 6px; 
            margin-top: 20px;
            border: 1px solid #e2e8f0;
        }
        .section-title { 
            color: #574964; 
            font-size: 14px; 
            font-weight: bold; 
            text-transform: uppercase; 
            margin-bottom: 15px;
            letter-spacing: 0.5px;
        }
        .footer { 
            text-align: center; 
            margin-top: 30px; 
            padding-top: 20px; 
            border-top: 1px solid #e5e7eb; 
            color: #6b7280; 
            font-size: 13px; 
        }
        .footer-note { margin: 5px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${config.icon} Rent Payment ${isTenant ? 'Reminder' : 'Notification'}</h1>
            <div style="font-size: 14px; margin-top: 5px; opacity: 0.9;">Rodriguez Properties Management</div>
        </div>
        
        <div class="content">
            <div class="priority-badge">
                ${config.icon} ${config.priorityEn}
            </div>

            <div class="greeting">
                Dear ${data.name},
            </div>

            <!-- ENGLISH CONTENT -->
            <div class="message-box">
                <p style="margin-top: 0; font-size: 15px;">${mainMessageEn}</p>
                
                <div class="amount-highlight">
                    <div style="font-size: 14px; color: #6b7280; margin-bottom: 5px;">Amount Due</div>
                    <div style="font-size: 24px; font-weight: bold; color: ${config.color};">₱${data.billingAmount.toLocaleString()}</div>
                    <div style="font-size: 14px; color: #6b7280; margin-top: 5px;">Due Date: ${data.dueDate}</div>
                </div>
            </div>

            <div class="action-box">
                <strong style="color: ${config.color};">📋 Action Required:</strong>
                <p style="margin: 10px 0 0 0;">${actionMessageEn}</p>
            </div>

            ${isTenant ? `
            <div style="background: #e0f2fe; border: 1px solid #0ea5e9; padding: 15px; border-radius: 6px; margin: 20px 0; font-size: 14px;">
                <strong>💡 Payment Options:</strong>
                <p style="margin: 10px 0 0 0;">You can process your payment through the Rodriguez Properties mobile application or contact the property management office for assistance.</p>
            </div>
            ` : ''}

            <div class="divider"></div>

            <!-- TAGALOG TRANSLATION -->
            <div class="tagalog-section">
                <div class="section-title">🇵🇭 Salin sa Tagalog (Tagalog Translation)</div>
                
                <div class="priority-badge" style="margin-top: 15px;">
                    ${config.icon} ${config.priorityTl}
                </div>

                <div class="greeting">
                    Mahal na ${data.name},
                </div>

                <p style="font-size: 15px;">${mainMessageTl}</p>
                
                <div class="amount-highlight">
                    <div style="font-size: 14px; color: #6b7280; margin-bottom: 5px;">Halagang Dapat Bayaran</div>
                    <div style="font-size: 24px; font-weight: bold; color: ${config.color};">₱${data.billingAmount.toLocaleString()}</div>
                    <div style="font-size: 14px; color: #6b7280; margin-top: 5px;">Takdang Araw: ${data.dueDate}</div>
                </div>

                <div class="action-box">
                    <strong style="color: ${config.color};">📋 Kinakailangang Aksyon:</strong>
                    <p style="margin: 10px 0 0 0;">${actionMessageTl}</p>
                </div>

                ${isTenant ? `
                <div style="background: #e0f2fe; border: 1px solid #0ea5e9; padding: 15px; border-radius: 6px; margin: 20px 0; font-size: 14px;">
                    <strong>💡 Mga Paraan ng Pagbabayad:</strong>
                    <p style="margin: 10px 0 0 0;">Maaari kayong magbayad sa pamamagitan ng Rodriguez Properties mobile application o makipag-ugnayan sa property management office para sa tulong.</p>
                </div>
                ` : ''}
            </div>

            <div class="footer">
                <p class="footer-note"><strong>Rodriguez Properties Management</strong></p>
                <p class="footer-note">📧 This is an automated notification. Please do not reply to this email.</p>
                <p class="footer-note">For inquiries, please contact the property management office.</p>
                <p class="footer-note" style="margin-top: 10px; font-size: 11px;">Ito ay isang awtomatikong mensahe. Huwag magreply sa email na ito.</p>
            </div>
        </div>
    </div>
</body>
</html>
    `;

    const subjectMap = {
      overdue: '⚠️ URGENT: Overdue Rent Payment',
      due_today: '🔔 REMINDER: Rent Payment Due Today',
      due_soon: '📅 REMINDER: Rent Payment Due Soon',
      upcoming: '📌 NOTICE: Upcoming Rent Payment'
    };

    const mailOptions = {
      from: {
        name: process.env.EMAIL_FROM_NAME || 'Rodriguez Properties Management',
        address: process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER!,
      },
      to: data.to,
      subject: subjectMap[data.billingType],
      html: emailTemplate,
    };

    const result = await transporter.sendMail(mailOptions);

    console.log('✅ Billing reminder email sent:', {
      to: data.to,
      type: data.billingType,
      role: data.role,
      messageId: result.messageId,
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Error sending billing reminder email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred while sending billing reminder email',
    };
  }
};
