const mongoose = require('mongoose');
const Delivery = require('../models/Delivery');
const PurchaseOrder = require('../models/PurchaseOrder');
const MaterialRequest = require('../models/MaterialRequest');
const Material = require('../models/Material');
const Inventory = require('../models/Inventory');
const Notification = require('../models/Notification');
const User = require('../models/User');
const logActivity = require('../utils/audit');
const { applyProjectStockChange } = require('../utils/projectStock');

const toObjectId = (id) => {
  if (!id) return id;
  if (id instanceof mongoose.Types.ObjectId) return id;
  if (mongoose.Types.ObjectId.isValid(id)) return new mongoose.Types.ObjectId(id);
  return id;
};

const toDateOnlyYMD = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.split('T')[0];
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const BUSY_DELIVERY_STATUSES = [
  'Scheduled',
  'Preparing',
  'Dispatched',
  'In Transit',
  'Delayed',
  'Rescheduled'
];

/** Same driver + same calendar day + same time slot cannot hold two open jobs. */
async function findDriverTimeSlotConflict({ driverId, dateYmd, timeSlot, excludeId }) {
  const slot = String(timeSlot || '').trim();
  if (!driverId || !dateYmd || !slot) return null;

  const query = {
    driver: toObjectId(driverId),
    timeSlot: slot,
    status: { $in: BUSY_DELIVERY_STATUSES }
  };
  if (excludeId) query._id = { $ne: excludeId };

  const openJobs = await Delivery.find(query)
    .populate('purchaseOrder', 'purchaseOrderNumber')
    .select('deliveryDate timeSlot purchaseOrder status')
    .lean();

  return openJobs.find((job) => toDateOnlyYMD(job.deliveryDate) === dateYmd) || null;
}

function driverBusySlotError(conflict, timeSlot) {
  const po = conflict?.purchaseOrder?.purchaseOrderNumber || 'PO kale';
  return `Darawalkan wuxuu hore u haystaa delivery isla maalintaas iyo isla saacadda (${timeSlot}). Mashruuca: ${po}. Dooro darawal kale ama time slot kale.`;
}

// @desc    Schedule delivery for accepted PO
// @route   POST /api/deliveries
// @access  Private/Procurement Officer
exports.scheduleDelivery = async (req, res, next) => {
  try {
    const {
      purchaseOrder,
      driver,
      deliveryAddress,
      deliveryDate,
      timeSlot
    } = req.body;

    const po = await PurchaseOrder.findById(purchaseOrder).populate('materialRequest');
    if (!po) {
      return res.status(404).json({ success: false, error: 'Purchase order not found' });
    }

    if (!po.materialRequest?.requiredDate) {
      return res.status(400).json({
        success: false,
        error: 'Purchase order has no Site Engineer required date'
      });
    }

    // Verify driver is Delivery Staff
    const driverUser = await User.findById(driver);
    if (!driverUser || driverUser.role !== 'Delivery Staff') {
      return res.status(400).json({ success: false, error: 'Assigned user must be a Delivery Staff driver' });
    }

    // Vehicle must come from the driver's registered profile (not client override)
    const lockedVehicle = (driverUser.vehiclePlateCode || '').trim();
    if (!lockedVehicle) {
      return res.status(400).json({
        success: false,
        error: 'Selected driver has no registered vehicle plate code'
      });
    }

    // Delivery may be on or before the Site Engineer required date — not after
    const requiredYmd = toDateOnlyYMD(po.materialRequest.requiredDate);
    const submittedYmd = toDateOnlyYMD(deliveryDate);
    if (!submittedYmd || submittedYmd > requiredYmd) {
      const requiredDisplay = new Date(`${requiredYmd}T00:00:00`).toLocaleDateString();
      return res.status(400).json({
        success: false,
        error: `Taariikhda waa in ay ahaato ${requiredDisplay} ama ka hor. Lama dooran karo taariikh ka dambeeya taariikhda Site Engineer-ku soo codsaday.`
      });
    }

    const lockedDeliveryDate = submittedYmd;
    const lockedSlot = String(timeSlot || '').trim();
    if (!lockedSlot) {
      return res.status(400).json({ success: false, error: 'Time slot is required' });
    }

    const slotConflict = await findDriverTimeSlotConflict({
      driverId: driver,
      dateYmd: lockedDeliveryDate,
      timeSlot: lockedSlot
    });
    if (slotConflict) {
      return res.status(400).json({
        success: false,
        error: driverBusySlotError(slotConflict, lockedSlot)
      });
    }

    const delivery = await Delivery.create({
      purchaseOrder,
      driver,
      scheduledBy: req.user.id,
      vehicle: lockedVehicle,
      vehicleType: driverUser.vehicleType || '',
      vehicleModel: driverUser.vehicleModel || '',
      deliveryAddress,
      deliveryDate: lockedDeliveryDate,
      originalDeliveryDate: lockedDeliveryDate,
      timeSlot: lockedSlot,
      status: 'Scheduled'
    });

    // Update PO status to Preparing
    po.status = 'Preparing';
    await po.save();

    await logActivity(req, req.user, 'Schedule Delivery', `Scheduled delivery for PO ${po.purchaseOrderNumber}. Assigned Driver: ${driverUser.name}`);

    // Notify Driver
    await Notification.create({
      user: driver,
      title: 'New Delivery Route Assigned',
      message: `You have been assigned a delivery for PO ${po.purchaseOrderNumber} scheduled on ${new Date(lockedDeliveryDate).toLocaleDateString()} (${timeSlot}).`,
      type: 'Delivery'
    });

    res.status(201).json({ success: true, delivery });
  } catch (error) {
    next(error);
  }
};

// @desc    Get deliveries (role-adapted)
// @route   GET /api/deliveries
// @access  Private
exports.getDeliveries = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, fromDate, toDate } = req.query;
    const query = {};

    if (status) query.status = status;

    if (fromDate || toDate) {
      query.deliveryDate = {};
      if (fromDate) query.deliveryDate.$gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        query.deliveryDate.$lte = end;
      }
    }

    // Role filtration
    if (req.user.role === 'Delivery Staff') {
      query.driver = toObjectId(req.user.id);
    } else if (req.user.role === 'Site Engineer') {
      // Find requests submitted by Engineer, and match deliveries linked to those request POs
      const requests = await MaterialRequest.find({ requestedBy: req.user.id });
      const requestIds = requests.map(r => r._id);
      const pos = await PurchaseOrder.find({ materialRequest: { $in: requestIds } });
      const poIds = pos.map(po => po._id);
      query.purchaseOrder = { $in: poIds.map(toObjectId) };
    }

    const count = await Delivery.countDocuments(query);
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Number(limit) || 10);

    // Latest PO first (PO-2026-00005 above 00004), then newest delivery
    const sortedIds = await Delivery.aggregate([
      { $match: query },
      {
        $lookup: {
          from: 'purchaseorders',
          localField: 'purchaseOrder',
          foreignField: '_id',
          as: 'poDoc'
        }
      },
      { $unwind: { path: '$poDoc', preserveNullAndEmptyArrays: true } },
      {
        $sort: {
          'poDoc.purchaseOrderNumber': -1,
          createdAt: -1
        }
      },
      { $skip: (pageNum - 1) * limitNum },
      { $limit: limitNum },
      { $project: { _id: 1 } }
    ]);

    const idOrder = sortedIds.map((d) => d._id.toString());
    const deliveriesRaw = await Delivery.find({ _id: { $in: sortedIds.map((d) => d._id) } })
      .populate('driver', 'name phone vehiclePlateCode vehicleType vehicleModel')
      .populate('scheduledBy', 'name role')
      .populate('rescheduleHistory.changedBy', 'name role')
      .populate({
        path: 'purchaseOrder',
        populate: [
          { path: 'supplier', select: 'company name' },
          { path: 'items.material', select: 'name unit' },
          { path: 'materialRequest', populate: { path: 'project', select: 'name location manager' } }
        ]
      });

    const byId = new Map(deliveriesRaw.map((d) => [d._id.toString(), d]));
    const deliveries = idOrder.map((id) => byId.get(id)).filter(Boolean);

    res.status(200).json({
      success: true,
      deliveries,
      totalPages: Math.ceil(count / limitNum) || 1,
      currentPage: pageNum,
      totalDeliveries: count
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update delivery status & Auto update inventory
// @route   PUT /api/deliveries/:id/status
// @access  Private/Delivery Staff
exports.updateDeliveryStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['Preparing', 'Dispatched', 'In Transit', 'Delivered', 'Delayed', 'Rescheduled', 'Cancelled'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid delivery status' });
    }

    const delivery = await Delivery.findById(req.params.id)
      .populate('driver')
      .populate({
        path: 'purchaseOrder',
        populate: {
          path: 'materialRequest',
          populate: [{ path: 'project' }, { path: 'requestedBy' }]
        }
      });

    if (!delivery) {
      return res.status(404).json({ success: false, error: 'Delivery record not found' });
    }

    // Verify ownership
    if (delivery.driver._id.toString() !== req.user.id && req.user.role !== 'Administrator') {
      return res.status(403).json({ success: false, error: 'Not authorized to change status' });
    }

    const oldStatus = delivery.status;
    delivery.status = status;
    if (status === 'Delivered' && oldStatus !== 'Delivered') {
      delivery.actualDeliveredAt = new Date();
    }
    await delivery.save();

    // Propagate status update to Purchase Order
    const populatedPo = delivery.purchaseOrder;
    const po = await PurchaseOrder.findById(populatedPo._id);
    po.status = status === 'Delivered' ? 'Delivered' : status;
    await po.save();

    await logActivity(req, req.user, `Delivery Status Update - ${status}`, `Delivery ID: ${delivery._id} set from ${oldStatus} to ${status}`);

    const mr = populatedPo.materialRequest;
    const projectId = mr?.project?._id || mr?.project || null;
    const requesterId = mr?.requestedBy?._id || mr?.requestedBy || null;

    // Auto-update Inventory + project/site stock when status becomes "Delivered"
    if (status === 'Delivered' && oldStatus !== 'Delivered') {
      for (const item of po.items) {
        if (projectId) {
          await applyProjectStockChange({
            projectId,
            materialId: item.material,
            quantity: item.quantity,
            type: 'Stock In',
            referenceType: 'Delivery',
            referenceId: delivery._id
          });
        } else {
          await Inventory.create({
            material: item.material,
            project: null,
            quantity: item.quantity,
            type: 'Stock In',
            referenceType: 'Delivery',
            referenceId: delivery._id
          });
        }

        await Material.findByIdAndUpdate(item.material, {
          $inc: { currentStock: item.quantity }
        });
      }

      if (requesterId) {
        await Notification.create({
          user: requesterId,
          title: 'Materials Delivered on Site',
          message: `Delivery completed for PO ${po.purchaseOrderNumber}. Please confirm receipt of your requested materials.`,
          type: 'Delivery'
        });
      }
    } else {
      if (requesterId) {
        await Notification.create({
          user: requesterId,
          title: `Delivery Shipment ${status}`,
          message: `Your material shipment for PO ${po.purchaseOrderNumber} is now marked as "${status}". Driver: ${delivery.driver.name}.`,
          type: 'Delivery'
        });
      }
    }

    res.status(200).json({ success: true, delivery });
  } catch (error) {
    next(error);
  }
};

// @desc    Reschedule a delivery (save original/new date, reason, actor, timestamp)
// @route   PUT /api/deliveries/:id/reschedule
// @access  Private/Procurement Officer, Administrator
exports.rescheduleDelivery = async (req, res, next) => {
  try {
    const { newDeliveryDate, timeSlot, reason } = req.body;

    if (!newDeliveryDate) {
      return res.status(400).json({ success: false, error: 'New delivery date is required' });
    }
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ success: false, error: 'Reason for rescheduling is required' });
    }

    const delivery = await Delivery.findById(req.params.id)
      .populate('driver', 'name')
      .populate('purchaseOrder', 'purchaseOrderNumber');

    if (!delivery) {
      return res.status(404).json({ success: false, error: 'Delivery record not found' });
    }

    if (['Delivered', 'Cancelled'].includes(delivery.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot reschedule a delivery with status "${delivery.status}"`
      });
    }

    const originalDate = delivery.deliveryDate;
    const previousTimeSlot = delivery.timeSlot;
    const newDateYmd = toDateOnlyYMD(newDeliveryDate);
    if (!newDateYmd) {
      return res.status(400).json({ success: false, error: 'New delivery date is invalid' });
    }
    const newDate = new Date(`${newDateYmd}T00:00:00.000Z`);
    const newSlot = timeSlot && String(timeSlot).trim()
      ? String(timeSlot).trim()
      : delivery.timeSlot;

    const driverId = delivery.driver?._id || delivery.driver;
    const slotConflict = await findDriverTimeSlotConflict({
      driverId,
      dateYmd: newDateYmd,
      timeSlot: newSlot,
      excludeId: delivery._id
    });
    if (slotConflict) {
      return res.status(400).json({
        success: false,
        error: driverBusySlotError(slotConflict, newSlot)
      });
    }

    if (!delivery.originalDeliveryDate) {
      delivery.originalDeliveryDate = originalDate;
    }

    delivery.rescheduleHistory.push({
      originalDate,
      newDate,
      previousTimeSlot,
      newTimeSlot: newSlot,
      reason: String(reason).trim(),
      changedBy: req.user.id,
      changedAt: new Date()
    });

    delivery.deliveryDate = newDate;
    delivery.timeSlot = newSlot;
    delivery.status = 'Rescheduled';
    await delivery.save();

    const poNumber = delivery.purchaseOrder?.purchaseOrderNumber || delivery._id;
    await logActivity(
      req,
      req.user,
      'Reschedule Delivery',
      `PO ${poNumber}: ${new Date(originalDate).toLocaleDateString()} → ${newDate.toLocaleDateString()}. Reason: ${String(reason).trim()}`
    );

    if (delivery.driver?._id || delivery.driver) {
      const driverId = delivery.driver._id || delivery.driver;
      await Notification.create({
        user: driverId,
        title: 'Delivery Rescheduled',
        message: `Delivery for PO ${poNumber} moved to ${newDate.toLocaleDateString()} (${newSlot}). Reason: ${String(reason).trim()}`,
        type: 'Delivery'
      });
    }

    const updated = await Delivery.findById(delivery._id)
      .populate('driver', 'name phone vehiclePlateCode')
      .populate('scheduledBy', 'name role')
      .populate('rescheduleHistory.changedBy', 'name role')
      .populate({
        path: 'purchaseOrder',
        populate: [
          { path: 'supplier', select: 'company name' },
          { path: 'items.material', select: 'name unit' },
          { path: 'materialRequest', populate: { path: 'project', select: 'name location' } }
        ]
      });

    res.status(200).json({ success: true, delivery: updated });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload Delivery Note (file or path string)
// @route   PUT /api/deliveries/:id/note
// @access  Private/Delivery Staff
exports.uploadDeliveryNote = async (req, res, next) => {
  try {
    const deliveryNoteFile = req.file
      ? `/uploads/delivery-notes/${req.file.filename}`
      : (typeof req.body.deliveryNoteFile === 'string'
          ? req.body.deliveryNoteFile.trim()
          : '');

    if (!deliveryNoteFile) {
      return res.status(400).json({
        success: false,
        error: 'Delivery note file is required (upload a PDF/image or provide a path)'
      });
    }

    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) {
      return res.status(404).json({ success: false, error: 'Delivery record not found' });
    }

    delivery.deliveryNoteFile = deliveryNoteFile;
    await delivery.save();

    await logActivity(
      req,
      req.user,
      'Upload Delivery Note',
      `Delivery note saved for delivery ${delivery._id}`
    );

    res.status(200).json({ success: true, delivery });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a scheduled delivery
// @route   DELETE /api/deliveries/:id
// @access  Private/Procurement Officer, Administrator
exports.deleteDelivery = async (req, res, next) => {
  try {
    const delivery = await Delivery.findById(req.params.id).populate('purchaseOrder');
    if (!delivery) {
      return res.status(404).json({ success: false, error: 'Delivery record not found' });
    }

    const poNumber = delivery.purchaseOrder?.purchaseOrderNumber || delivery._id;
    await Delivery.findByIdAndDelete(req.params.id);

    await logActivity(req, req.user, 'Delete Delivery', `Deleted delivery for PO ${poNumber}`);

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};
