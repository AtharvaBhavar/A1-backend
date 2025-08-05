// const express = require('express');
// const Component = require('../models/Component');
// const Log = require('../models/Log');
// const { verifyToken } = require('../middleware/auth');

// const router = express.Router();

// // Natural language processing for inventory commands
// const processChatbotMessage = async (message, user) => {
//   const lowerMessage = message.toLowerCase().trim();
  
//   try {
//     // Add/Inward commands
//     if (lowerMessage.includes('add') || lowerMessage.includes('inward')) {
//       const addMatch = lowerMessage.match(/add\s+(\d+)\s+(.+?)(?:\s+to\s+(.+?))?(?:\s+for\s+(.+?))?$/i) ||
//                      lowerMessage.match(/inward\s+(\d+)\s+(.+?)(?:\s+to\s+(.+?))?(?:\s+for\s+(.+?))?$/i);
      
//       if (addMatch) {
//         const quantity = parseInt(addMatch[1]);
//         const componentSearch = addMatch[2].trim();
//         const reason = addMatch[4] || 'Chatbot inventory addition';
        
//         // Find component by name or part number
//         const component = await Component.findOne({
//           $or: [
//             { component_name: { $regex: componentSearch, $options: 'i' } },
//             { part_number: { $regex: componentSearch, $options: 'i' } }
//           ]
//         });
        
//         if (!component) {
//           return {
//             success: false,
//             message: `Component "${componentSearch}" not found. Please check the name or part number.`,
//             suggestions: ['Try searching with part number', 'Check component spelling', 'View all components first']
//           };
//         }
        
//         // Check user permissions
//         if (!['Admin', 'Lab Technician'].includes(user.role)) {
//           return {
//             success: false,
//             message: 'You do not have permission to add inventory. Only Admins and Lab Technicians can perform inward operations.',
//             suggestions: ['Contact an Admin or Lab Technician', 'View component details instead']
//           };
//         }
        
//         const previousQuantity = component.quantity;
//         const newQuantity = previousQuantity + quantity;
        
//         // Update component
//         await Component.findByIdAndUpdate(component._id, { 
//           quantity: newQuantity,
//           updatedBy: user._id
//         });
        
//         // Create log
//         const log = new Log({
//           component: component._id,
//           action: 'inward',
//           quantity_changed: quantity,
//           previous_quantity: previousQuantity,
//           new_quantity: newQuantity,
//           reason,
//           user: user._id,
//           notes: 'Added via chatbot'
//         });
//         await log.save();
        
//         return {
//           success: true,
//           message: ` Successfully added ${quantity} units of ${component.component_name} (${component.part_number}). New quantity: ${newQuantity}`,
//           data: {
//             component: component.component_name,
//             partNumber: component.part_number,
//             previousQuantity,
//             newQuantity,
//             quantityAdded: quantity
//           }
//         };
//       }
//     }
    
//     // Remove/Outward commands
//     if (lowerMessage.includes('remove') || lowerMessage.includes('outward') || lowerMessage.includes('take')) {
//       const removeMatch = lowerMessage.match(/(?:remove|outward|take)\s+(\d+)\s+(.+?)(?:\s+for\s+(.+?))?$/i);
      
//       if (removeMatch) {
//         const quantity = parseInt(removeMatch[1]);
//         const componentSearch = removeMatch[2].trim();
//         const projectName = removeMatch[3] || 'Chatbot inventory removal';
        
//         const component = await Component.findOne({
//           $or: [
//             { component_name: { $regex: componentSearch, $options: 'i' } },
//             { part_number: { $regex: componentSearch, $options: 'i' } }
//           ]
//         });
        
//         if (!component) {
//           return {
//             success: false,
//             message: `Component "${componentSearch}" not found. Please check the name or part number.`,
//             suggestions: ['Try searching with part number', 'Check component spelling', 'View all components first']
//           };
//         }
        
//         // Check user permissions
//         if (!['Admin', 'Engineer', 'Lab Technician'].includes(user.role)) {
//           return {
//             success: false,
//             message: 'You do not have permission to remove inventory. Only Admins, Engineers, and Lab Technicians can perform outward operations.',
//             suggestions: ['Contact an authorized user', 'View component details instead']
//           };
//         }
        
//         // Check quantity availability
//         if (component.quantity < quantity) {
//           return {
//             success: false,
//             message: `Insufficient quantity available. Requested: ${quantity}, Available: ${component.quantity}`,
//             data: {
//               component: component.component_name,
//               partNumber: component.part_number,
//               available: component.quantity,
//               requested: quantity
//             }
//           };
//         }
        
//         const previousQuantity = component.quantity;
//         const newQuantity = previousQuantity - quantity;
        
//         // Update component
//         await Component.findByIdAndUpdate(component._id, { 
//           quantity: newQuantity,
//           last_outward: new Date(),
//           updatedBy: user._id
//         });
        
//         // Create log
//         const log = new Log({
//           component: component._id,
//           action: 'outward',
//           quantity_changed: -quantity,
//           previous_quantity: previousQuantity,
//           new_quantity: newQuantity,
//           reason: 'Chatbot inventory removal',
//           project_name: projectName,
//           user: user._id,
//           notes: 'Removed via chatbot'
//         });
//         await log.save();
        
//         return {
//           success: true,
//           message: ` Successfully removed ${quantity} units of ${component.component_name} (${component.part_number}) for ${projectName}. Remaining quantity: ${newQuantity}`,
//           data: {
//             component: component.component_name,
//             partNumber: component.part_number,
//             previousQuantity,
//             newQuantity,
//             quantityRemoved: quantity,
//             projectName
//           }
//         };
//       }
//     }
    
//     // Show/Find component commands
//     if (lowerMessage.includes('show') || lowerMessage.includes('find') || lowerMessage.includes('search') || lowerMessage.includes('what is')) {
//       const searchMatch = lowerMessage.match(/(?:show|find|search|what is)\s+(?:the\s+)?(?:quantity\s+of\s+)?(.+?)$/i);
      
//       if (searchMatch) {
//         const componentSearch = searchMatch[1].trim();
        
//         const components = await Component.find({
//           $or: [
//             { component_name: { $regex: componentSearch, $options: 'i' } },
//             { part_number: { $regex: componentSearch, $options: 'i' } },
//             { description: { $regex: componentSearch, $options: 'i' } }
//           ]
//         }).limit(5);
        
//         if (components.length === 0) {
//           return {
//             success: false,
//             message: `No components found matching "${componentSearch}".`,
//             suggestions: ['Try a different search term', 'Check spelling', 'Browse by category']
//           };
//         }
        
//         if (components.length === 1) {
//           const comp = components[0];
//           return {
//             success: true,
//             message: ` ${comp.component_name} (${comp.part_number})\n` +
//                     `Quantity: ${comp.quantity}\n` +
//                     `Location: ${comp.location_bin}\n` +
//                     `Supplier: ${comp.manufacturer_supplier}\n` +
//                     `Category: ${comp.category}\n` +
//                     `${comp.quantity <= comp.critical_low_threshold ? ' LOW STOCK' : ' In Stock'}`,
//             data: {
//               component: comp,
//               isLowStock: comp.quantity <= comp.critical_low_threshold
//             }
//           };
//         }
        
//         const componentList = components.map(comp => 
//           `• ${comp.component_name} (${comp.part_number}) - Qty: ${comp.quantity} - ${comp.location_bin}`
//         ).join('\n');
        
//         return {
//           success: true,
//           message: `Found ${components.length} components matching "${componentSearch}":\n\n${componentList}`,
//           data: { components }
//         };
//       }
//     }
    
//     // Low stock commands
//     if (lowerMessage.includes('low stock') || lowerMessage.includes('low inventory')) {
//       const lowStockComponents = await Component.find({
//         $expr: { $lte: ['$quantity', '$critical_low_threshold'] }
//       }).limit(10);
      
//       if (lowStockComponents.length === 0) {
//         return {
//           success: true,
//           message: ' Great news! No components are currently low on stock.',
//           data: { lowStockComponents: [] }
//         };
//       }
      
//       const lowStockList = lowStockComponents.map(comp => 
//         ` ${comp.component_name} (${comp.part_number}) - Qty: ${comp.quantity}/${comp.critical_low_threshold}`
//       ).join('\n');
      
//       return {
//         success: true,
//         message: ` Found ${lowStockComponents.length} components with low stock:\n\n${lowStockList}`,
//         data: { lowStockComponents }
//       };
//     }
    
//     // Category-based search
//     if (lowerMessage.includes('show all') || lowerMessage.includes('list all')) {
//       const categoryMatch = lowerMessage.match(/(?:show all|list all)\s+(.+?)$/i);
      
//       if (categoryMatch) {
//         const category = categoryMatch[1].trim();
//         const categories = ['ics', 'resistors', 'capacitors', 'inductors', 'diodes', 'transistors', 'connectors', 'sensors', 'modules', 'pcbs', 'tools'];
        
//         const matchedCategory = categories.find(cat => 
//           category.toLowerCase().includes(cat) || cat.includes(category.toLowerCase())
//         );
        
//         if (matchedCategory) {
//           const properCategory = matchedCategory.charAt(0).toUpperCase() + matchedCategory.slice(1);
//           const components = await Component.find({ 
//             category: { $regex: properCategory, $options: 'i' } 
//           }).limit(10);
          
//           if (components.length === 0) {
//             return {
//               success: false,
//               message: `No components found in category "${properCategory}".`,
//               suggestions: ['Try a different category', 'View all categories']
//             };
//           }
          
//           const componentList = components.map(comp => 
//             `• ${comp.component_name} (${comp.part_number}) - Qty: ${comp.quantity}`
//           ).join('\n');
          
//           return {
//             success: true,
//             message: ` Found ${components.length} components in "${properCategory}" category:\n\n${componentList}`,
//             data: { components, category: properCategory }
//           };
//         }
//       }
//     }
    
//     // Help commands
//     if (lowerMessage.includes('help') || lowerMessage === '?') {
//       return {
//         success: true,
//         message: ` **LIMS Chatbot Help**\n\n` +
//                 `**Inventory Commands:**\n` +
//                 `• "Add 50 resistors" - Add inventory\n` +
//                 `• "Remove 10 NE555 for Project Alpha" - Remove inventory\n` +
//                 `• "Outward 5 ESP32 for IoT project" - Remove for project\n\n` +
//                 `**Search Commands:**\n` +
//                 `• "Show NE555" - Find specific component\n` +
//                 `• "What is the quantity of ESP32" - Check quantity\n` +
//                 `• "Find capacitors" - Search components\n\n` +
//                 `**Reports:**\n` +
//                 `• "Show low stock" - View low stock items\n` +
//                 `• "List all ICs" - View by category\n\n` +
//                 `**Tips:**\n` +
//                 `• Use component names or part numbers\n` +
//                 `• Be specific with quantities and reasons\n` +
//                 `• Permissions apply based on your role`,
//         data: { isHelp: true }
//       };
//     }
    
//     // Default response for unrecognized commands
//     return {
//       success: false,
//       message: `I didn't understand that command. Here are some examples:\n\n` +
//               `• "Add 50 resistors"\n` +
//               `• "Remove 10 NE555 for Project Alpha"\n` +
//               `• "Show ESP32"\n` +
//               `• "Show low stock"\n` +
//               `• "Help" - for more commands`,
//       suggestions: [
//         'Try "help" for command list',
//         'Be specific with component names',
//         'Include quantities and reasons'
//       ]
//     };
    
//   } catch (error) {
//     console.error('Chatbot processing error:', error);
//     return {
//       success: false,
//       message: 'An error occurred while processing your request. Please try again or contact support.',
//       error: error.message
//     };
//   }
// };

// // Chat endpoint
// router.post('/chat', verifyToken, async (req, res) => {
//   try {
//     const { message } = req.body;
    
//     if (!message || typeof message !== 'string' || message.trim().length === 0) {
//       return res.status(400).json({ 
//         message: 'Please provide a valid message',
//         success: false 
//       });
//     }
    
//     const response = await processChatbotMessage(message, req.user);
    
//     res.json({
//       userMessage: message,
//       botResponse: response.message,
//       success: response.success,
//       data: response.data,
//       suggestions: response.suggestions,
//       timestamp: new Date().toISOString()
//     });
//   } catch (error) {
//     console.error('Chatbot error:', error);
//     res.status(500).json({ 
//       message: 'Error processing chatbot request', 
//       error: error.message,
//       success: false
//     });
//   }
// });

// // Get chat history/context (could be expanded to store chat history)
// router.get('/history', verifyToken, async (req, res) => {
//   try {
//     // For now, return recent user activities as context
//     const recentLogs = await Log.find({ user: req.user._id })
//       .populate('component', 'component_name part_number')
//       .sort({ createdAt: -1 })
//       .limit(5);
    
//     const context = recentLogs.map(log => ({
//       action: log.action,
//       component: log.component.component_name,
//       partNumber: log.component.part_number,
//       quantity: Math.abs(log.quantity_changed),
//       date: log.createdAt,
//       reason: log.reason
//     }));
    
//     res.json({
//       recentActivity: context,
//       message: 'Here\'s your recent inventory activity for context.'
//     });
//   } catch (error) {
//     console.error('Chat history error:', error);
//     res.status(500).json({ 
//       message: 'Error fetching chat history', 
//       error: error.message 
//     });
//   }
// });


// module.exports = router;


const express = require('express');
const Component = require('../models/Component');
const Log = require('../models/Log');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Natural language processing for inventory commands
const processChatbotMessage = async (message, user) => {
  const lowerMessage = message.toLowerCase().trim();
  
  try {
    // Add/Inward commands
    if (lowerMessage.includes('add') || lowerMessage.includes('inward') || lowerMessage.includes('stock')) {
      const addMatch = lowerMessage.match(/add\s+(\d+)\s+(.+?)(?:\s+to\s+(.+?))?(?:\s+for\s+(.+?))?$/i) ||
                     lowerMessage.match(/inward\s+(\d+)\s+(.+?)(?:\s+to\s+(.+?))?(?:\s+for\s+(.+?))?$/i) ||
                     lowerMessage.match(/stock\s+(\d+)\s+(.+?)(?:\s+to\s+(.+?))?(?:\s+for\s+(.+?))?$/i);
      
      if (addMatch) {
        const quantity = parseInt(addMatch[1]);
        const componentSearch = addMatch[2].trim();
        const reason = addMatch[4] || 'Chatbot inventory addition';
        
        // Find component by name or part number
        const component = await Component.findOne({
          $or: [
            { component_name: { $regex: componentSearch, $options: 'i' } },
            { part_number: { $regex: componentSearch, $options: 'i' } }
          ]
        });
        
        if (!component) {
          return {
            success: false,
            message: `Component "${componentSearch}" not found. Please check the name or part number.`,
            suggestions: ['Try searching with part number', 'Check component spelling', 'View all components first']
          };
        }
        
        // Check user permissions
        if (!['Admin', 'Lab Technician'].includes(user.role)) {
          return {
            success: false,
            message: 'You do not have permission to add inventory. Only Admins and Lab Technicians can perform inward operations.',
            suggestions: ['Contact an Admin or Lab Technician', 'View component details instead']
          };
        }
        
        const previousQuantity = component.quantity;
        const newQuantity = previousQuantity + quantity;
        
        // Update component
        await Component.findByIdAndUpdate(component._id, { 
          quantity: newQuantity,
          updatedBy: user._id
        });
        
        // Create log
        const log = new Log({
          component: component._id,
          action: 'inward',
          quantity_changed: quantity,
          previous_quantity: previousQuantity,
          new_quantity: newQuantity,
          reason,
          user: user._id,
          notes: 'Added via chatbot'
        });
        await log.save();
        
        return {
          success: true,
          message: ` Successfully added ${quantity} units of ${component.component_name} (${component.part_number}).\n\nPrevious quantity: ${previousQuantity}\nNew quantity: ${newQuantity}\nLocation: ${component.location_bin}`,
          data: {
            component: component.component_name,
            partNumber: component.part_number,
            previousQuantity,
            newQuantity,
            quantityAdded: quantity
          }
        };
      }
    }
    
    // Remove/Outward commands
    if (lowerMessage.includes('remove') || lowerMessage.includes('outward') || lowerMessage.includes('take')) {
      const removeMatch = lowerMessage.match(/(?:remove|outward|take)\s+(\d+)\s+(.+?)(?:\s+for\s+(.+?))?$/i);
      
      if (removeMatch) {
        const quantity = parseInt(removeMatch[1]);
        const componentSearch = removeMatch[2].trim();
        const projectName = removeMatch[3] || 'Chatbot inventory removal';
        
        const component = await Component.findOne({
          $or: [
            { component_name: { $regex: componentSearch, $options: 'i' } },
            { part_number: { $regex: componentSearch, $options: 'i' } }
          ]
        });
        
        if (!component) {
          return {
            success: false,
            message: `Component "${componentSearch}" not found. Please check the name or part number.`,
            suggestions: ['Try searching with part number', 'Check component spelling', 'View all components first']
          };
        }
        
        // Check user permissions
        if (!['Admin', 'Engineer', 'Lab Technician'].includes(user.role)) {
          return {
            success: false,
            message: 'You do not have permission to remove inventory. Only Admins, Engineers, and Lab Technicians can perform outward operations.',
            suggestions: ['Contact an authorized user', 'View component details instead']
          };
        }
        
        // Check quantity availability
        if (component.quantity < quantity) {
          return {
            success: false,
            message: `Insufficient quantity available. Requested: ${quantity}, Available: ${component.quantity}`,
            data: {
              component: component.component_name,
              partNumber: component.part_number,
              available: component.quantity,
              requested: quantity
            }
          };
        }
        
        const previousQuantity = component.quantity;
        const newQuantity = previousQuantity - quantity;
        
        // Update component
        await Component.findByIdAndUpdate(component._id, { 
          quantity: newQuantity,
          last_outward: new Date(),
          updatedBy: user._id
        });
        
        // Create log
        const log = new Log({
          component: component._id,
          action: 'outward',
          quantity_changed: -quantity,
          previous_quantity: previousQuantity,
          new_quantity: newQuantity,
          reason: 'Chatbot inventory removal',
          project_name: projectName,
          user: user._id,
          notes: 'Removed via chatbot'
        });
        await log.save();
        
        return {
          success: true,
          message: ` Successfully removed ${quantity} units of ${component.component_name} (${component.part_number}) for ${projectName}.\n\nPrevious quantity: ${previousQuantity}\nRemaining quantity: ${newQuantity}\nLocation: ${component.location_bin}`,
          data: {
            component: component.component_name,
            partNumber: component.part_number,
            previousQuantity,
            newQuantity,
            quantityRemoved: quantity,
            projectName
          }
        };
      }
    }
    
    // Show/Find component commands
    if (lowerMessage.includes('show') || lowerMessage.includes('find') || lowerMessage.includes('search') || lowerMessage.includes('what is')) {
      const searchMatch = lowerMessage.match(/(?:show|find|search|what is)\s+(?:the\s+)?(?:quantity\s+of\s+)?(.+?)$/i);
      
      if (searchMatch) {
        const componentSearch = searchMatch[1].trim();
        
        const components = await Component.find({
          $or: [
            { component_name: { $regex: componentSearch, $options: 'i' } },
            { part_number: { $regex: componentSearch, $options: 'i' } },
            { description: { $regex: componentSearch, $options: 'i' } }
          ]
        }).limit(5);
        
        if (components.length === 0) {
          return {
            success: false,
            message: `No components found matching "${componentSearch}".`,
            suggestions: ['Try a different search term', 'Check spelling', 'Browse by category']
          };
        }
        
        if (components.length === 1) {
          const comp = components[0];
          return {
            success: true,
            message: `📦 **${comp.component_name}** (${comp.part_number})\n\n` +
                    `**Current Quantity:** ${comp.quantity}\n` +
                    `**Location:** ${comp.location_bin}\n` +
                    `**Supplier:** ${comp.manufacturer_supplier}\n` +
                    `**Category:** ${comp.category}\n` +
                    `**Unit Price:** $${comp.unit_price}\n` +
                    `**Status:** ${comp.quantity <= comp.critical_low_threshold ? '⚠️ LOW STOCK' : '✅ In Stock'}`,
            data: {
              component: comp,
              isLowStock: comp.quantity <= comp.critical_low_threshold
            }
          };
        }
        
        const componentList = components.map(comp => 
          `• ${comp.component_name} (${comp.part_number}) - Qty: ${comp.quantity} - ${comp.location_bin}`
        ).join('\n');
        
        return {
          success: true,
          message: `🔍 Found ${components.length} components matching "${componentSearch}":\n\n${componentList}\n\nTip: Use specific part numbers for exact matches.`,
          data: { components }
        };
      }
    }
    
    // Low stock commands
    if (lowerMessage.includes('low stock') || lowerMessage.includes('low inventory')) {
      const lowStockComponents = await Component.find({
        $expr: { $lte: ['$quantity', '$critical_low_threshold'] }
      }).limit(10);
      
      if (lowStockComponents.length === 0) {
        return {
          success: true,
          message: '✅ Great news! No components are currently low on stock.',
          data: { lowStockComponents: [] }
        };
      }
      
      const lowStockList = lowStockComponents.map(comp => 
        `⚠️ ${comp.component_name} (${comp.part_number}) - Qty: ${comp.quantity}/${comp.critical_low_threshold}`
      ).join('\n');
      
      return {
        success: true,
        message: `📊 **Low Stock Alert** - Found ${lowStockComponents.length} components:\n\n${lowStockList}\n\n💡 Consider reordering these items soon.`,
        data: { lowStockComponents }
      };
    }
    
    // Category-based search
    if (lowerMessage.includes('show all') || lowerMessage.includes('list all')) {
      const categoryMatch = lowerMessage.match(/(?:show all|list all)\s+(.+?)$/i);
      
      if (categoryMatch) {
        const category = categoryMatch[1].trim();
        const categories = ['ics', 'resistors', 'capacitors', 'inductors', 'diodes', 'transistors', 'connectors', 'sensors', 'modules', 'pcbs', 'tools'];
        
        const matchedCategory = categories.find(cat => 
          category.toLowerCase().includes(cat) || cat.includes(category.toLowerCase())
        );
        
        if (matchedCategory) {
          const properCategory = matchedCategory.charAt(0).toUpperCase() + matchedCategory.slice(1);
          const components = await Component.find({ 
            category: { $regex: properCategory, $options: 'i' } 
          }).limit(10);
          
          if (components.length === 0) {
            return {
              success: false,
              message: `No components found in category "${properCategory}".`,
              suggestions: ['Try a different category', 'View all categories']
            };
          }
          
          const componentList = components.map(comp => 
            `• ${comp.component_name} (${comp.part_number}) - Qty: ${comp.quantity}`
          ).join('\n');
          
          return {
            success: true,
            message: `📦 **${properCategory} Components** - Found ${components.length} items:\n\n${componentList}`,
            data: { components, category: properCategory }
          };
        }
      }
    }
    
    // Help commands
    if (lowerMessage.includes('help') || lowerMessage === '?') {
      return {
        success: true,
        message: `🤖 **LIMS Assistant Help**\n\n` +
                `**Inventory Commands:**\n` +
                `• "Add 50 resistors" - Add stock\n` +
                `• "Remove 10 NE555 for Project Alpha" - Remove inventory\n` +
                `• "Stock 100 capacitors" - Add stock\n\n` +
                `**Search Commands:**\n` +
                `• "Show NE555" - Find specific component\n` +
                `• "What is the quantity of ESP32?" - Check stock\n` +
                `• "Find capacitors" - Search components\n\n` +
                `**Reports:**\n` +
                `• "Show low stock" - View low stock items\n` +
                `• "List all ICs" - View by category\n\n` +
                `**Tips:**\n` +
                `• Use component names or part numbers\n` +
                `• Be specific with quantities\n` +
                `• Your role (${user.role}) determines available actions`,
        data: { isHelp: true }
      };
    }
    
    // Default response for unrecognized commands
    return {
      success: false,
      message: `❓ I didn't understand "${message}". Here are some examples:\n\n` +
              `• "Add 50 resistors"\n` +
              `• "Remove 10 NE555 for Project Alpha"\n` +
              `• "What is the quantity of ESP32?"\n` +
              `• "Show low stock"\n` +
              `• Type "Help" for more commands`,
      suggestions: [
        'Help',
        'Show low stock',
        'Add 10 resistors',
        'What is the quantity of NE555?'
      ]
    };
    
  } catch (error) {
    console.error('Chatbot processing error:', error);
    return {
      success: false,
      message: '❌ An error occurred while processing your request. Please try again or contact support if the problem persists.',
      error: error.message
    };
  }
};

// Chat endpoint
router.post('/chat', verifyToken, async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ 
        message: 'Please provide a valid message',
        success: false 
      });
    }
    
    if (message.trim().length > 500) {
      return res.status(400).json({ 
        message: 'Message too long. Please keep it under 500 characters.',
        success: false 
      });
    }
    
    const response = await processChatbotMessage(message, req.user);
    
    res.json({
      userMessage: message,
      botResponse: response.message,
      success: response.success,
      data: response.data,
      suggestions: response.suggestions,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Chatbot error:', error);
    res.status(500).json({ 
      message: 'Internal server error. Please try again later.', 
      error: error.message,
      success: false
    });
  }
});

// Get chat history/context (could be expanded to store chat history)
router.get('/history', verifyToken, async (req, res) => {
  try {
    // For now, return recent user activities as context
    const recentLogs = await Log.find({ user: req.user._id })
      .populate('component', 'component_name part_number')
      .sort({ createdAt: -1 })
      .limit(5);
    
    const context = recentLogs.map(log => ({
      action: log.action,
      component: log.component.component_name,
      partNumber: log.component.part_number,
      quantity: Math.abs(log.quantity_changed),
      date: log.createdAt,
      reason: log.reason
    }));
    
    res.json({
      recentActivity: context,
      message: `Here's your recent inventory activity, ${req.user.name}.`
    });
  } catch (error) {
    console.error('Chat history error:', error);
    res.status(500).json({ 
      message: 'Error fetching activity history', 
      error: error.message 
    });
  }
});

module.exports = router;