import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import { query, initDb } from './db.js';

export async function seedDatabase() {
  await initDb();

  // Check if users already exist
  const existingUsers = await query.all('SELECT id FROM users LIMIT 1');
  if (existingUsers.length > 0) {
    console.log('Database already contains data, skipping seed.');
    return;
  }

  console.log('Seeding EquipTrack initial data...');
  const hashedPassword = bcrypt.hashSync('password123', 10);

  // 1. Seed Users (Admin, Custodian, Borrowers)
  const users = [
    {
      name: 'System IT Administrator',
      email: 'admin@school.edu',
      password: hashedPassword,
      role: 'ADMIN',
      department: 'Management Information Systems',
      student_or_staff_id: 'ADM-2024-001',
      phone: '+1 (555) 019-2831'
    },
    {
      name: 'Sarah Jenkins (Lab Custodian)',
      email: 'custodian@school.edu',
      password: hashedPassword,
      role: 'CUSTODIAN',
      department: 'Science & Media Equipment Depot',
      student_or_staff_id: 'CUST-2024-042',
      phone: '+1 (555) 014-9921'
    },
    {
      name: 'Alex Rivera (Student)',
      email: 'borrower@school.edu',
      password: hashedPassword,
      role: 'BORROWER',
      department: 'Computer Science & Media Arts',
      student_or_staff_id: 'STU-2024-8841',
      phone: '+1 (555) 012-3456'
    },
    {
      name: 'Dr. Michael Chen (Faculty)',
      email: 'chen@school.edu',
      password: hashedPassword,
      role: 'BORROWER',
      department: 'Physics & Engineering Department',
      student_or_staff_id: 'FAC-2024-1002',
      phone: '+1 (555) 018-7712'
    }
  ];

  for (const u of users) {
    await query.run(
      `INSERT INTO users (name, email, password, role, department, student_or_staff_id, phone)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [u.name, u.email, u.password, u.role, u.department, u.student_or_staff_id, u.phone]
    );
  }

  // 2. Seed Equipment
  const sampleEquipment = [
    {
      asset_tag: 'EQP-LAP-001',
      name: 'MacBook Pro 16" M3 Max',
      category: 'Laptops',
      model: 'Apple Silicon M3 Max (36GB RAM / 1TB SSD)',
      serial_number: 'C02GM88LMD6M',
      status: 'AVAILABLE',
      condition_notes: 'Pristine condition, battery cycle count 12. Includes 140W MagSafe charger.',
      location: 'IT Lab Rack A1',
      image_url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80'
    },
    {
      asset_tag: 'EQP-LAP-002',
      name: 'Dell XPS 15 (4K OLED Touch)',
      category: 'Laptops',
      model: 'Intel Core i9-13900H (32GB RAM / RTX 4070)',
      serial_number: 'DL-9382-XPS',
      status: 'BORROWED',
      condition_notes: 'Minor scratch on bottom plate. Screen and keyboard immaculate.',
      location: 'IT Lab Rack A2',
      image_url: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=600&q=80'
    },
    {
      asset_tag: 'EQP-CAM-101',
      name: 'Sony FX3 Cinema Camera Kit',
      category: 'Cameras',
      model: 'Full-Frame Cinema Line with XLR Top Handle',
      serial_number: 'SNY-FX3-8820',
      status: 'AVAILABLE',
      condition_notes: 'Includes 24-70mm GM II lens, 2x CFexpress Type A cards, 3x NP-FZ100 batteries.',
      location: 'Media Studio Vault Locker 3',
      image_url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=600&q=80'
    },
    {
      asset_tag: 'EQP-CAM-102',
      name: 'Canon EOS R5 Mirrorless Camera',
      category: 'Cameras',
      model: 'Canon R5 45MP 8K RAW',
      serial_number: 'CN-R5-9921',
      status: 'AVAILABLE',
      condition_notes: 'Clean sensor. Includes RF 50mm f/1.2 lens and Pelican hard case.',
      location: 'Media Studio Vault Locker 4',
      image_url: 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=600&q=80'
    },
    {
      asset_tag: 'EQP-PRJ-201',
      name: 'Epson Pro L1070U 4K Laser Projector',
      category: 'Projectors',
      model: '7,000 Lumens WUXGA 3LCD Laser',
      serial_number: 'EPS-L10-4412',
      status: 'AVAILABLE',
      condition_notes: 'Equipped with standard zoom lens. 480 hours laser life used.',
      location: 'Auditorium AV Storage C-2',
      image_url: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=600&q=80'
    },
    {
      asset_tag: 'EQP-PRJ-202',
      name: 'ViewSonic M2 Portable Smart Projector',
      category: 'Projectors',
      model: '1080p Full HD Harman Kardon Audio',
      serial_number: 'VS-M2-7719',
      status: 'BORROWED',
      condition_notes: 'Compact unit with USB-C power bank support and carrying pouch.',
      location: 'IT Lab Rack B1',
      image_url: 'https://images.unsplash.com/photo-1535016120720-40c646be5580?auto=format&fit=crop&w=600&q=80'
    },
    {
      asset_tag: 'EQP-LAB-301',
      name: 'Rigol DS1054Z Digital Oscilloscope',
      category: 'Laboratory Tools',
      model: '50MHz 4-Channel 1GSa/s with UltraVision',
      serial_number: 'RGL-DS-5014',
      status: 'AVAILABLE',
      condition_notes: 'Calibrated Oct 2024. Includes 4 passive probes and grounding clips.',
      location: 'EE Hardware Lab 312 Workbench 4',
      image_url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80'
    },
    {
      asset_tag: 'EQP-LAB-302',
      name: 'Olympus CX23 Binocular Microscope',
      category: 'Laboratory Tools',
      model: 'Biological LED Compound Microscope (4x, 10x, 40x, 100x Oil)',
      serial_number: 'OLY-CX23-119',
      status: 'UNDER_REPAIR',
      condition_notes: '40x objective lens has loose focus ring. Under repair with optics vendor.',
      location: 'Biology Lab 105 Prep Room',
      image_url: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=600&q=80'
    },
    {
      asset_tag: 'EQP-AUD-401',
      name: 'RØDE Wireless PRO Dual Mic Kit',
      category: 'Audio/Visual',
      model: 'Dual-Channel 32-bit Float Recording Wireless System',
      serial_number: 'ROD-WPRO-662',
      status: 'AVAILABLE',
      condition_notes: 'Includes 2x transmitters, 1x receiver, charging smart case, and lavalier mics.',
      location: 'Media Studio Vault Locker 1',
      image_url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=600&q=80'
    }
  ];

  for (const eq of sampleEquipment) {
    // Generate QR Code data URL
    const qrData = JSON.stringify({
      asset_tag: eq.asset_tag,
      name: eq.name,
      serial: eq.serial_number
    });
    const qrCodeImage = await QRCode.toDataURL(qrData);

    await query.run(
      `INSERT INTO equipment (asset_tag, name, category, model, serial_number, status, condition_notes, location, qr_data, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [eq.asset_tag, eq.name, eq.category, eq.model, eq.serial_number, eq.status, eq.condition_notes, eq.location, qrCodeImage, eq.image_url]
    );
  }

  // 3. Seed Sample Transactions
  // Transaction 1: Active checked out item (Dell XPS 15 borrowed by Alex Rivera)
  const alex = await query.get("SELECT id FROM users WHERE email = 'borrower@school.edu'");
  const custodian = await query.get("SELECT id FROM users WHERE email = 'custodian@school.edu'");
  const dell = await query.get("SELECT id FROM equipment WHERE asset_tag = 'EQP-LAP-002'");
  const projector = await query.get("SELECT id FROM equipment WHERE asset_tag = 'EQP-PRJ-202'");
  const microscope = await query.get("SELECT id FROM equipment WHERE asset_tag = 'EQP-LAB-302'");

  if (alex && custodian && dell) {
    const today = new Date();
    const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const tomorrow = new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString();

    const t1 = await query.run(
      `INSERT INTO transactions (equipment_id, borrower_id, custodian_id, status, purpose, request_start_date, request_end_date, actual_checkout_date, checkout_condition_notes)
       VALUES (?, ?, ?, 'CHECKED_OUT', 'Capstone AI Model Training and Benchmark Testing', ?, ?, ?, ?)`,
      [dell.id, alex.id, custodian.id, threeDaysAgo, tomorrow, threeDaysAgo, 'Pre-inspection: Minor scuff on corner. Screen and hinge 100% fine.']
    );

    // Add Check-Out Inspection Photo
    await query.run(
      `INSERT INTO transaction_photos (transaction_id, photo_type, image_url, caption, uploaded_by)
       VALUES (?, 'CHECK_OUT', 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=600&q=80', 'Pre-checkout inspection: Verified casing and port conditions', ?)`,
      [t1.lastID, custodian.id]
    );
  }

  // Transaction 2: Overdue item (ViewSonic Projector borrowed by Dr. Chen)
  const chen = await query.get("SELECT id FROM users WHERE email = 'chen@school.edu'");
  if (chen && custodian && projector) {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

    const t2 = await query.run(
      `INSERT INTO transactions (equipment_id, borrower_id, custodian_id, status, purpose, request_start_date, request_end_date, actual_checkout_date, checkout_condition_notes, overdue_alert_sent, overdue_alert_count)
       VALUES (?, ?, ?, 'OVERDUE', 'Department Seminar and Guest Lecture', ?, ?, ?, ?, ?, ?)`,
      [projector.id, chen.id, custodian.id, fiveDaysAgo, twoDaysAgo, fiveDaysAgo, 'Projector clean, power cable and remote control included.', 1, 2]
    );

    await query.run(
      `INSERT INTO transaction_photos (transaction_id, photo_type, image_url, caption, uploaded_by)
       VALUES (?, 'CHECK_OUT', 'https://images.unsplash.com/photo-1535016120720-40c646be5580?auto=format&fit=crop&w=600&q=80', 'Pre-checkout inspection: Lens cap intact, casing pristine', ?)`,
      [t2.lastID, custodian.id]
    );
  }

  // Transaction 3: Returned item with damage logged (Olympus microscope)
  if (alex && custodian && microscope) {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const t3 = await query.run(
      `INSERT INTO transactions (equipment_id, borrower_id, custodian_id, status, purpose, request_start_date, request_end_date, actual_checkout_date, actual_return_date, checkout_condition_notes, return_condition_notes, has_damage, damage_severity)
       VALUES (?, ?, ?, 'RETURNED', 'Cell Biology Microscopy Project', ?, ?, ?, ?, ?, ?, 1, 'MODERATE')`,
      [
        microscope.id,
        alex.id,
        custodian.id,
        tenDaysAgo,
        eightDaysAgo,
        tenDaysAgo,
        sevenDaysAgo,
        'Pre-checkout: Objective lenses checked and operational.',
        'Post-inspection: 40x objective lens was found loose and unscrewed improperly. Casing marked. Transferred to Under Repair status.',
      ]
    );

    // Checkout photo
    await query.run(
      `INSERT INTO transaction_photos (transaction_id, photo_type, image_url, caption, uploaded_by)
       VALUES (?, 'CHECK_OUT', 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=600&q=80', 'Pre-checkout baseline photo', ?)`,
      [t3.lastID, custodian.id]
    );

    // Return damage photo
    await query.run(
      `INSERT INTO transaction_photos (transaction_id, photo_type, image_url, caption, uploaded_by)
       VALUES (?, 'CHECK_IN', 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=600&q=80', 'Post-return damage log: Loose 40x lens mount documented', ?)`,
      [t3.lastID, custodian.id]
    );
  }

  // 4. Initial Security Audit Logs
  const auditEntries = [
    {
      user_id: 1,
      user_name: 'System IT Administrator',
      user_role: 'ADMIN',
      action: 'SYSTEM_BOOTSTRAP',
      entity_type: 'SYSTEM',
      entity_id: 'CORE-SYS',
      ip_address: '127.0.0.1',
      details: 'EquipTrack system database initialized with RBAC security controls and equipment master catalog.'
    },
    {
      user_id: 2,
      user_name: 'Sarah Jenkins (Lab Custodian)',
      user_role: 'CUSTODIAN',
      action: 'CHECK_OUT',
      entity_type: 'TRANSACTION',
      entity_id: 'EQP-LAP-002',
      ip_address: '192.168.1.105',
      details: 'Verified QR tag EQP-LAP-002. Pre-condition photo captured. Handed over to Alex Rivera (STU-2024-8841).'
    },
    {
      user_id: 2,
      user_name: 'Sarah Jenkins (Lab Custodian)',
      user_role: 'CUSTODIAN',
      action: 'CHECK_IN_DAMAGE',
      entity_type: 'TRANSACTION',
      entity_id: 'EQP-LAB-302',
      ip_address: '192.168.1.105',
      details: 'Item returned with moderate damage: 40x lens mount loose. Photo evidence recorded. Status moved to UNDER_REPAIR.'
    }
  ];

  for (const a of auditEntries) {
    await query.run(
      `INSERT INTO audit_logs (user_id, user_name, user_role, action, entity_type, entity_id, ip_address, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [a.user_id, a.user_name, a.user_role, a.action, a.entity_type, a.entity_id, a.ip_address, a.details]
    );
  }

  console.log('Database seeded successfully!');
}

// Run standalone if executed directly
if (process.argv[1]?.endsWith('seed.js')) {
  seedDatabase().then(() => process.exit(0)).catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
