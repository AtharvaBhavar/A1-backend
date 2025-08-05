const Component = require('../models/Component');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendLowStockAlert, sendStaleStockAlert } = require('./nodemailer');

// Check for low stock components
const checkLowStock = async () => {
  try {
    console.log('Checking for low stock components...');
    
    const lowStockComponents = await Component.find({
      $expr: { $lte: ['$quantity', '$critical_low_threshold'] }
    });

    if (lowStockComponents.length === 0) {
      return;
    }

    console.log(`Found ${lowStockComponents.length} low stock components`);

    // Get admin emails
    const admins = await User.find({ 
      role: 'Admin', 
      isActive: true 
    }).select('email');
    const adminEmails = admins.map(admin => admin.email);

    for (const component of lowStockComponents) {
      // Check if notification already exists for this component
      const existingNotification = await Notification.findOne({
        type: 'low_stock',
        'data.componentId': component._id,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      });

      if (!existingNotification) {
        // Create in-app notification
        const notification = new Notification({
          type: 'low_stock',
          title: 'Low Stock Alert',
          message: `${component.component_name} (${component.part_number}) is running low. Current quantity: ${component.quantity}, Threshold: ${component.critical_low_threshold}`,
          data: {
            componentId: component._id,
            quantity: component.quantity,
            threshold: component.critical_low_threshold
          },
          targetRoles: ['Admin', 'Lab Technician'],
          priority: 'high'
        });

        await notification.save();

        // Send email alert
        if (adminEmails.length > 0) {
          const emailSent = await sendLowStockAlert(component, adminEmails);
          if (emailSent) {
            notification.emailSent = true;
            notification.emailSentAt = new Date();
            await notification.save();
          }
        }

        console.log(`Low stock alert created for ${component.component_name}`);
      }
    }
  } catch (error) {
    console.error('Error checking low stock:', error);
  }
};

// Check for stale stock components (unused for 90+ days)
const checkStaleStock = async () => {
  try {
    console.log('Checking for stale stock components...');
    
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const staleComponents = await Component.find({
      last_outward: { $lt: ninetyDaysAgo },
      quantity: { $gt: 0 }
    });

    if (staleComponents.length === 0) {
      return;
    }

    console.log(`Found ${staleComponents.length} stale components`);

    // Check if notification already exists today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const existingNotification = await Notification.findOne({
      type: 'stale_stock',
      createdAt: { $gte: today }
    });

    if (!existingNotification && staleComponents.length > 0) {
      // Create in-app notification
      const notification = new Notification({
        type: 'stale_stock',
        title: 'Stale Stock Report',
        message: `${staleComponents.length} components have not been used in the last 90 days`,
        data: {
          componentCount: staleComponents.length,
          additionalInfo: staleComponents.map(comp => ({
            id: comp._id,
            name: comp.component_name,
            partNumber: comp.part_number,
            quantity: comp.quantity,
            lastOutward: comp.last_outward
          }))
        },
        targetRoles: ['Admin'],
        priority: 'medium'
      });

      await notification.save();

      // Send email report
      const admins = await User.find({ 
        role: 'Admin', 
        isActive: true 
      }).select('email');
      const adminEmails = admins.map(admin => admin.email);

      if (adminEmails.length > 0) {
        const emailSent = await sendStaleStockAlert(staleComponents, adminEmails);
        if (emailSent) {
          notification.emailSent = true;
          notification.emailSentAt = new Date();
          await notification.save();
        }
      }

      console.log(`Stale stock report created for ${staleComponents.length} components`);
    }
  } catch (error) {
    console.error('Error checking stale stock:', error);
  }
};

module.exports = {
  checkLowStock,
  checkStaleStock
};