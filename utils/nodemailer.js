const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'your-email@gmail.com',
      pass: process.env.EMAIL_PASS || 'your-app-password'
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

// Send low stock alert
const sendLowStockAlert = async (component, adminEmails) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_USER || 'lims-system@yourcompany.com',
       to: adminEmails.join(', '),
      subject: `🚨 Low Stock Alert: ${component.component_name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #dc2626, #ef4444); padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ Low Stock Alert</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #111827; margin-top: 0;">Component Running Low</h2>
            
            <div style="background: white; padding: 20px; border-radius: 6px; border-left: 4px solid #dc2626;">
              <table style="width: 100%; font-size: 14px;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #374151;">Component:</td>
                  <td style="padding: 8px 0; color: #111827;">${component.component_name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #374151;">Part Number:</td>
                  <td style="padding: 8px 0; color: #111827;">${component.part_number}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #374151;">Current Quantity:</td>
                  <td style="padding: 8px 0; color: #dc2626; font-weight: bold;">${component.quantity}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #374151;">Critical Threshold:</td>
                  <td style="padding: 8px 0; color: #111827;">${component.critical_low_threshold}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #374151;">Location:</td>
                  <td style="padding: 8px 0; color: #111827;">${component.location_bin}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #374151;">Supplier:</td>
                  <td style="padding: 8px 0; color: #111827;">${component.manufacturer_supplier}</td>
                </tr>
              </table>
            </div>
            
            <div style="margin-top: 20px; padding: 15px; background: #fef3c7; border-radius: 6px; border-left: 4px solid #f59e0b;">
              <p style="margin: 0; color: #92400e; font-weight: 500;">
                📋 <strong>Action Required:</strong> Please reorder this component to maintain adequate inventory levels.
              </p>
            </div>
            
            <div style="margin-top: 30px; text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/components/${component._id}" 
                 style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">
                View Component Details
              </a>
            </div>
          </div>
          
          <div style="margin-top: 20px; text-align: center; color: #6b7280; font-size: 12px;">
            <p>This is an automated alert from your LIMS Inventory Management System</p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Low stock alert sent for ${component.component_name}`);
    return true;
  } catch (error) {
    console.error('Error sending low stock alert:', error);
    return false;
  }
};

// Send stale stock alert
const sendStaleStockAlert = async (components, adminEmails) => {
  try {
    const transporter = createTransporter();
    
    const componentList = components.map(comp => `
      <tr>
        <td style="padding: 8px; border: 1px solid #e5e7eb;">${comp.component_name}</td>
        <td style="padding: 8px; border: 1px solid #e5e7eb;">${comp.part_number}</td>
        <td style="padding: 8px; border: 1px solid #e5e7eb;">${comp.quantity}</td>
        <td style="padding: 8px; border: 1px solid #e5e7eb;">${comp.location_bin}</td>
        <td style="padding: 8px; border: 1px solid #e5e7eb;">${new Date(comp.last_outward).toLocaleDateString()}</td>
      </tr>
    `).join('');
    
    const mailOptions = {
      from: process.env.EMAIL_USER || 'lims-system@yourcompany.com',
      to: adminEmails.join(', '),
      subject: `📊 Stale Stock Report: ${components.length} Components Unused for 90+ Days`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #f59e0b, #fbbf24); padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">📊 Stale Stock Report</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #111827; margin-top: 0;">${components.length} Components Unused for 90+ Days</h2>
            
            <div style="background: #fef3c7; padding: 15px; border-radius: 6px; border-left: 4px solid #f59e0b; margin-bottom: 20px;">
              <p style="margin: 0; color: #92400e;">
                The following components haven't been used in the last 90 days. Consider reviewing their necessity or relocating them to reduce clutter.
              </p>
            </div>
            
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 6px; overflow: hidden;">
                <thead>
                  <tr style="background: #f3f4f6;">
                    <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #374151; border: 1px solid #e5e7eb;">Component</th>
                    <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #374151; border: 1px solid #e5e7eb;">Part Number</th>
                    <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #374151; border: 1px solid #e5e7eb;">Quantity</th>
                    <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #374151; border: 1px solid #e5e7eb;">Location</th>
                    <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #374151; border: 1px solid #e5e7eb;">Last Used</th>
                  </tr>
                </thead>
                <tbody>
                  ${componentList}
                </tbody>
              </table>
            </div>
            
            <div style="margin-top: 30px; text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" 
                 style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">
                View Dashboard
              </a>
            </div>
          </div>
          
          <div style="margin-top: 20px; text-align: center; color: #6b7280; font-size: 12px;">
            <p>This is an automated report from your LIMS Inventory Management System</p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Stale stock report sent for ${components.length} components`);
    return true;
  } catch (error) {
    console.error('Error sending stale stock alert:', error);
    return false;
  }
};

module.exports = {
  sendLowStockAlert,
  sendStaleStockAlert
};