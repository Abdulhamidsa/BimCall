import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { db } from "./db";
import { meetings, attendees, points, statusUpdates, attachments, projects, meetingSeries, meetingOccurrences, disciplines } from "@shared/schema";
import { format, addDays, subDays, addWeeks } from "date-fns";

neonConfig.webSocketConstructor = ws;

const clashImages = [
  "/stock_images/bim_clash_detection__5675d1ab.jpg",
  "/stock_images/bim_clash_detection__aa776e8f.jpg",
  "/stock_images/bim_clash_detection__c5431ab8.jpg",
  "/stock_images/bim_clash_detection__bc8712ac.jpg",
  "/stock_images/bim_clash_detection__46c245f7.jpg",
  "/stock_images/bim_clash_detection__1db91ca8.jpg",
];

// MVP Disciplines to be seeded
const MVP_DISCIPLINES = [
  { code: "GEN", name: "General" },
  { code: "ARCH", name: "Architectural" },
  { code: "STR", name: "Structural" },
  { code: "MEP", name: "MEP General" },
  { code: "EL", name: "Electrical" },
  { code: "MECH", name: "Mechanical" },
  { code: "PL", name: "Plumbing" },
  { code: "FIRE", name: "Fire Protection" },
  { code: "ICT", name: "ICT / Low Current" },
  { code: "CIVIL", name: "Civil/Site" },
  { code: "QA", name: "QA/QC" },
];

// Seed disciplines without clearing existing data (safe to run multiple times)
export async function seedDisciplines() {
  console.log("Seeding disciplines...");
  for (const disc of MVP_DISCIPLINES) {
    try {
      await db.insert(disciplines).values(disc).onConflictDoNothing();
    } catch (error) {
      // Ignore if already exists
    }
  }
  console.log("Disciplines seeded (or already exist)");
}

async function seed() {
  console.log("Seeding database...");

  try {
    await db.delete(attachments);
    await db.delete(statusUpdates);
    await db.delete(points);
    await db.delete(attendees);
    await db.delete(meetingOccurrences);
    await db.delete(meetingSeries);
    await db.delete(meetings);
    await db.delete(projects);
    console.log("Cleared existing data");

    // Create Projects
    const [project1] = await db.insert(projects).values({
      name: "Skyline Tower A",
      code: "SKY-TWR-A",
      description: "54-story mixed-use tower featuring premium office space, luxury residences, and ground floor retail. LEED Gold certification targeted.",
      street: "123 Financial District Boulevard",
      city: "London",
      country: "United Kingdom",
      status: "active",
      client: "Skyline Development Corp",
      startDate: "2024-03-01",
      endDate: "2027-06-30",
      constructionType: "commercial",
      contractValue: "450000000",
    }).returning();

    const [project2] = await db.insert(projects).values({
      name: "Horizon Medical Center",
      code: "HOR-MED-01",
      description: "State-of-the-art 300-bed hospital with specialized cardiac and oncology wings, research facilities, and helipad.",
      street: "456 Healthcare Avenue",
      city: "Berlin",
      country: "Germany",
      status: "active",
      client: "Ministry of Health",
      startDate: "2024-01-15",
      endDate: "2026-12-31",
      constructionType: "healthcare",
      contractValue: "680000000",
    }).returning();

    const [project3] = await db.insert(projects).values({
      name: "Metro Logistics Hub",
      code: "MET-LOG-22",
      description: "1.2M sq ft automated warehouse and distribution center with cold storage, cross-docking, and last-mile delivery facilities.",
      street: "789 Industrial Park Road",
      city: "Amsterdam",
      country: "Netherlands",
      status: "planning",
      client: "Euro Logistics Partners",
      startDate: "2025-02-01",
      endDate: "2026-08-30",
      constructionType: "industrial",
      contractValue: "180000000",
    }).returning();

    const [project4] = await db.insert(projects).values({
      name: "Riverside Residences",
      code: "RIV-RES-02",
      description: "Luxury waterfront residential development comprising 120 apartments and premium penthouses with river views.",
      street: "25 Waterfront Promenade",
      city: "Paris",
      country: "France",
      status: "on_hold",
      client: "Seine Vista Development",
      startDate: "2024-06-01",
      endDate: "2026-09-30",
      constructionType: "residential",
      contractValue: "320000000",
    }).returning();

    console.log("Created 4 projects");

    // Attendees pool
    const attendeePool = [
      { name: "Alex Chen", email: "alex@bimcoord.com", role: "BIM Manager", avatar: "AC", status: "accepted" },
      { name: "Sarah Jones", email: "sarah@struct.com", role: "Structural Eng", avatar: "SJ", status: "accepted" },
      { name: "Mike Ross", email: "mike@mep.com", role: "MEP Lead", avatar: "MR", status: "tentative" },
      { name: "David Kim", email: "david@arch.com", role: "Architect", avatar: "DK", status: "accepted" },
      { name: "Lisa Wang", email: "lisa@facade.com", role: "Facade Consultant", avatar: "LW", status: "accepted" },
      { name: "James Wilson", email: "james@fire.com", role: "Fire Safety Eng", avatar: "JW", status: "accepted" },
      { name: "Emma Davis", email: "emma@elec.com", role: "Electrical Eng", avatar: "ED", status: "tentative" },
      { name: "Omar Hassan", email: "omar@plumb.com", role: "Plumbing Lead", avatar: "OH", status: "accepted" },
    ];

    // ===== RECURRING MEETING SERIES =====
    
    // Series 1: Weekly BIM Coordination for Skyline Tower
    const [series1] = await db.insert(meetingSeries).values({
      projectId: project1.id,
      title: "Weekly BIM Coordination",
      recurrenceRule: "weekly",
      startTime: "10:00",
      endTime: "11:30",
      location: "BIM Room / Teams",
      platform: "outlook",
      agenda: "Standard weekly BIM coordination meeting to review clashes, RFIs, and model updates.",
      meetingLink: "https://teams.microsoft.com/l/meetup-join/skyline-weekly-bim",
    }).returning();

    // Create occurrences for series 1
    for (let i = 0; i < 6; i++) {
      const date = addWeeks(new Date(), i);
      await db.insert(meetingOccurrences).values({
        seriesId: series1.id,
        date: format(date, "yyyy-MM-dd"),
        status: i < 2 ? "completed" : "scheduled",
        notes: i === 0 ? "Kickoff meeting - reviewed initial model" : undefined,
      });
    }

    // Series 2: Biweekly MEP Review for Medical Center
    const [series2] = await db.insert(meetingSeries).values({
      projectId: project2.id,
      title: "MEP Systems Review",
      recurrenceRule: "biweekly",
      startTime: "14:00",
      endTime: "15:30",
      location: "Virtual - Zoom",
      platform: "gmail",
      agenda: "Biweekly review of MEP coordination including medical gas, HVAC, and electrical systems.",
      meetingLink: "https://zoom.us/j/horizon-mep-review",
    }).returning();

    // Create occurrences for series 2
    for (let i = 0; i < 4; i++) {
      const date = addWeeks(new Date(), i * 2);
      await db.insert(meetingOccurrences).values({
        seriesId: series2.id,
        date: format(date, "yyyy-MM-dd"),
        status: i === 0 ? "completed" : "scheduled",
      });
    }

    // Series 3: Monthly Design Review for Metro Logistics
    const [series3] = await db.insert(meetingSeries).values({
      projectId: project3.id,
      title: "Monthly Design Progress Review",
      recurrenceRule: "monthly",
      startTime: "09:00",
      endTime: "11:00",
      location: "Client Office / Teams",
      platform: "outlook",
      agenda: "Monthly review with client on design progress, automation systems, and cold storage requirements.",
      meetingLink: "https://teams.microsoft.com/l/meetup-join/metro-monthly",
    }).returning();

    // Create occurrences for series 3
    for (let i = 0; i < 3; i++) {
      const date = addWeeks(new Date(), i * 4);
      await db.insert(meetingOccurrences).values({
        seriesId: series3.id,
        date: format(date, "yyyy-MM-dd"),
        status: "scheduled",
      });
    }

    console.log("Created 3 recurring meeting series with occurrences");

    // ===== REGULAR ONE-OFF MEETINGS =====
    
    const [meeting1_1] = await db.insert(meetings).values({
      projectId: project1.id,
      title: "Facade Installation Kickoff",
      date: format(new Date(), "yyyy-MM-dd"),
      startTime: "14:00",
      endTime: "15:30",
      location: "Site Office / Zoom",
      platform: "outlook",
      project: project1.name,
      agenda: "1. Curtain wall installation sequence\n2. Mock-up results review\n3. Material delivery schedule\n4. Weather contingency planning",
      meetingLink: "https://zoom.us/j/facade-review-skyline",
    }).returning();

    const [meeting1_2] = await db.insert(meetings).values({
      projectId: project1.id,
      title: "Structural Progress Review",
      date: format(addDays(new Date(), 7), "yyyy-MM-dd"),
      startTime: "11:00",
      endTime: "12:30",
      location: "Project HQ / Google Meet",
      platform: "gmail",
      project: project1.name,
      agenda: "1. Core wall progress\n2. Steel erection schedule\n3. Post-tension slab review\n4. Crane operations coordination",
      meetingLink: "https://meet.google.com/skyline-structural",
    }).returning();

    const [meeting2_1] = await db.insert(meetings).values({
      projectId: project2.id,
      title: "Radiology Suite Coordination",
      date: format(addDays(new Date(), 3), "yyyy-MM-dd"),
      startTime: "10:00",
      endTime: "11:30",
      location: "Conf Room A / Teams",
      platform: "outlook",
      project: project2.name,
      agenda: "1. Lead lining installation sequence\n2. MRI room shielding requirements\n3. CT scanner structural support\n4. Equipment access coordination",
      meetingLink: "https://teams.microsoft.com/l/meetup-join/horizon-radiology",
    }).returning();

    const [meeting2_2] = await db.insert(meetings).values({
      projectId: project2.id,
      title: "Emergency Department Layout Review",
      date: format(addDays(new Date(), 10), "yyyy-MM-dd"),
      startTime: "09:00",
      endTime: "10:30",
      location: "Site Office / Zoom",
      platform: "outlook",
      project: project2.name,
      agenda: "1. Trauma bay configuration\n2. Ambulance access coordination\n3. Patient flow optimization\n4. Equipment room locations",
      meetingLink: "https://zoom.us/j/horizon-emergency",
    }).returning();

    const [meeting3_1] = await db.insert(meetings).values({
      projectId: project3.id,
      title: "Automation Systems Coordination",
      date: format(addDays(new Date(), 5), "yyyy-MM-dd"),
      startTime: "14:00",
      endTime: "16:00",
      location: "Project HQ / Google Meet",
      platform: "gmail",
      project: project3.name,
      agenda: "1. Conveyor system routing\n2. Robotic arm clearances\n3. Control room location\n4. Power distribution requirements",
      meetingLink: "https://meet.google.com/metro-automation",
    }).returning();

    const [meeting4_1] = await db.insert(meetings).values({
      projectId: project4.id,
      title: "Apartment Prototype Review",
      date: format(addDays(new Date(), 2), "yyyy-MM-dd"),
      startTime: "10:00",
      endTime: "12:00",
      location: "Site Office / Zoom",
      platform: "outlook",
      project: project4.name,
      agenda: "1. Interior finishes selection\n2. MEP rough-in coordination\n3. Landscape integration\n4. Smart home systems",
      meetingLink: "https://zoom.us/j/riverside-prototype",
    }).returning();

    const [meeting4_2] = await db.insert(meetings).values({
      projectId: project4.id,
      title: "Landscape and Hardscape Coordination",
      date: format(addDays(new Date(), 14), "yyyy-MM-dd"),
      startTime: "14:00",
      endTime: "15:30",
      location: "Virtual - Teams",
      platform: "outlook",
      project: project4.name,
      agenda: "1. Irrigation system layout\n2. Pool construction sequence\n3. Outdoor lighting design\n4. Planting schedule",
      meetingLink: "https://teams.microsoft.com/l/meetup-join/riverside-landscape",
    }).returning();

    console.log("Created 7 regular one-off meetings");

    // Create Attendees for regular meetings
    const allMeetings = [meeting1_1, meeting1_2, meeting2_1, meeting2_2, meeting3_1, meeting4_1, meeting4_2];

    for (let i = 0; i < allMeetings.length; i++) {
      const meeting = allMeetings[i];
      const numAttendees = 3 + (i % 3);
      const shuffled = [...attendeePool].sort(() => 0.5 - Math.random());
      for (const att of shuffled.slice(0, numAttendees)) {
        await db.insert(attendees).values({
          meetingId: meeting.id,
          ...att,
        });
      }
    }
    console.log("Created attendees for all meetings");

    // ===== POINTS FOR RECURRING SERIES =====
    let imageIndex = 0;
    const getNextImage = () => clashImages[imageIndex++ % clashImages.length];

    // Points for Series 1 (Weekly BIM Coordination)
    await db.insert(points).values({
      seriesId: series1.id,
      meetingId: null,
      title: "Level 15-20 MEP Coordination",
      description: "Ongoing coordination of HVAC, electrical, and plumbing systems between floors 15-20. Multiple clashes identified in the corridor ceiling space.",
      image: getNextImage(),
      status: "ongoing",
      assignedTo: "Mike Ross",
      dueDate: format(addDays(new Date(), 14), "yyyy-MM-dd"),
    });

    await db.insert(points).values({
      seriesId: series1.id,
      meetingId: null,
      title: "Fire Rated Shaft Penetrations",
      description: "All MEP penetrations through fire-rated shafts need firestopping details. Awaiting submittal approval.",
      image: getNextImage(),
      status: "open",
      assignedTo: "James Wilson",
      dueDate: format(addDays(new Date(), 7), "yyyy-MM-dd"),
    });

    await db.insert(points).values({
      seriesId: series1.id,
      meetingId: null,
      title: "Elevator Shaft Ventilation",
      description: "Smoke exhaust fan location in elevator shaft conflicts with structural bracing. Alternative location needed.",
      image: getNextImage(),
      status: "new",
      assignedTo: "Alex Chen",
      dueDate: format(addDays(new Date(), 10), "yyyy-MM-dd"),
    });

    // Points for Series 2 (MEP Systems Review)
    await db.insert(points).values({
      seriesId: series2.id,
      meetingId: null,
      title: "Operating Room HVAC Controls",
      description: "Specialized HVAC control sequences for OR suites require BACnet integration with surgical lighting systems.",
      image: getNextImage(),
      status: "ongoing",
      assignedTo: "Mike Ross",
      dueDate: format(addDays(new Date(), 21), "yyyy-MM-dd"),
    });

    await db.insert(points).values({
      seriesId: series2.id,
      meetingId: null,
      title: "Medical Gas Manifold Room",
      description: "Medical gas manifold room ventilation requirements exceed available ceiling space. Need structural modification.",
      image: getNextImage(),
      status: "open",
      assignedTo: "Omar Hassan",
      dueDate: format(addDays(new Date(), 14), "yyyy-MM-dd"),
    });

    // Points for Series 3 (Monthly Design Review)
    await db.insert(points).values({
      seriesId: series3.id,
      meetingId: null,
      title: "Conveyor Height Clearance Review",
      description: "Automated sorting conveyor requires 4.5m clear height. Current design shows 4.2m at several locations.",
      image: getNextImage(),
      status: "new",
      assignedTo: "David Kim",
      dueDate: format(addDays(new Date(), 30), "yyyy-MM-dd"),
    });

    console.log("Created points for recurring series");

    // ===== POINTS FOR REGULAR MEETINGS =====
    // Including mix of statuses to test move points feature

    // Meeting 1_1 - Has unresolved points to test move feature
    await db.insert(points).values({
      meetingId: meeting1_1.id,
      title: "Curtain Wall Anchor Conflicts",
      description: "Several anchor locations on Level 18-22 conflict with edge-of-slab reinforcement. Coordinate with structural.",
      image: getNextImage(),
      status: "open",
      assignedTo: "Lisa Wang",
      dueDate: format(addDays(new Date(), 5), "yyyy-MM-dd"),
    });

    await db.insert(points).values({
      meetingId: meeting1_1.id,
      title: "Spandrel Panel Thermal Performance",
      description: "Thermal modeling shows potential condensation risk at spandrel zones. Review insulation buildup.",
      image: getNextImage(),
      status: "ongoing",
      assignedTo: "Sarah Jones",
      dueDate: format(addDays(new Date(), 10), "yyyy-MM-dd"),
    });

    await db.insert(points).values({
      meetingId: meeting1_1.id,
      title: "Mock-up Test Results",
      description: "Facade mock-up water infiltration test completed successfully. Documentation archived.",
      image: getNextImage(),
      status: "closed",
      assignedTo: "Lisa Wang",
      dueDate: format(subDays(new Date(), 5), "yyyy-MM-dd"),
    });

    // Meeting 1_2 - Has unresolved points
    await db.insert(points).values({
      meetingId: meeting1_2.id,
      title: "Core Wall Embedment Plates",
      description: "Steel connection embedment plates need coordination with rebar placement before concrete pour.",
      image: getNextImage(),
      status: "new",
      assignedTo: "Sarah Jones",
      dueDate: format(addDays(new Date(), 12), "yyyy-MM-dd"),
    });

    await db.insert(points).values({
      meetingId: meeting1_2.id,
      title: "Post-Tension Slab Sequence",
      description: "PT strand installation sequence conflicts with MEP rough-in schedule. Need revised phasing.",
      image: getNextImage(),
      status: "open",
      assignedTo: "Alex Chen",
      dueDate: format(addDays(new Date(), 8), "yyyy-MM-dd"),
    });

    // Meeting 2_1 - Has unresolved points
    await db.insert(points).values({
      meetingId: meeting2_1.id,
      title: "MRI Room RF Shielding",
      description: "Gap identified in RF shielding at conduit penetrations. Requires waveguide installation.",
      image: getNextImage(),
      status: "new",
      assignedTo: "Emma Davis",
      dueDate: format(addDays(new Date(), 7), "yyyy-MM-dd"),
    });

    await db.insert(points).values({
      meetingId: meeting2_1.id,
      title: "CT Scanner Floor Reinforcement",
      description: "CT scanner weight requires floor reinforcement. Structural engineer to provide details.",
      image: getNextImage(),
      status: "ongoing",
      assignedTo: "Sarah Jones",
      dueDate: format(addDays(new Date(), 14), "yyyy-MM-dd"),
    });

    // Meeting 2_2 - Has unresolved points
    await db.insert(points).values({
      meetingId: meeting2_2.id,
      title: "Trauma Bay Ceiling Access",
      description: "Medical gas outlets above trauma bays conflict with ceiling access panels. Reconfigure layout.",
      image: getNextImage(),
      status: "open",
      assignedTo: "Mike Ross",
      dueDate: format(addDays(new Date(), 18), "yyyy-MM-dd"),
    });

    // Meeting 3_1 - Mix of statuses
    await db.insert(points).values({
      meetingId: meeting3_1.id,
      title: "Robotic Arm Foundation",
      description: "Heavy-duty robotic arms require isolated foundations to prevent vibration transfer.",
      image: getNextImage(),
      status: "new",
      assignedTo: "Sarah Jones",
      dueDate: format(addDays(new Date(), 20), "yyyy-MM-dd"),
    });

    await db.insert(points).values({
      meetingId: meeting3_1.id,
      title: "Control Room Layout",
      description: "Control room location approved. Proceeding with detailed design.",
      image: getNextImage(),
      status: "closed",
      assignedTo: "David Kim",
      dueDate: format(subDays(new Date(), 3), "yyyy-MM-dd"),
    });

    // Meeting 4_1 - Has unresolved points
    await db.insert(points).values({
      meetingId: meeting4_1.id,
      title: "Kitchen Ventilation Clash",
      description: "Range hood exhaust duct conflicts with structural beam. Need alternative routing.",
      image: getNextImage(),
      status: "open",
      assignedTo: "Mike Ross",
      dueDate: format(addDays(new Date(), 7), "yyyy-MM-dd"),
    });

    await db.insert(points).values({
      meetingId: meeting4_1.id,
      title: "Smart Home Wiring",
      description: "Smart home system wiring paths through party walls need acoustic treatment details.",
      image: getNextImage(),
      status: "ongoing",
      assignedTo: "Emma Davis",
      dueDate: format(addDays(new Date(), 10), "yyyy-MM-dd"),
    });

    // Meeting 4_2 - Has unresolved points
    await db.insert(points).values({
      meetingId: meeting4_2.id,
      title: "Pool Equipment Room",
      description: "Pool equipment room ventilation conflicts with adjacent apartment unit. Review layout options.",
      image: getNextImage(),
      status: "new",
      assignedTo: "Omar Hassan",
      dueDate: format(addDays(new Date(), 21), "yyyy-MM-dd"),
    });

    console.log("Created points for regular meetings");

    // ===== STATUS UPDATES for some points =====
    const pointsWithHistory = await db.select().from(points).limit(5);
    
    for (const point of pointsWithHistory) {
      await db.insert(statusUpdates).values({
        pointId: point.id,
        date: format(subDays(new Date(), 3), "yyyy-MM-dd"),
        status: "Initial review completed. Awaiting structural input.",
        actionOn: "Alex Chen",
      });
      
      if (point.status === "ongoing" || point.status === "closed") {
        await db.insert(statusUpdates).values({
          pointId: point.id,
          date: format(subDays(new Date(), 1), "yyyy-MM-dd"),
          status: "Coordination meeting held. Solution proposed.",
          actionOn: point.assignedTo,
        });
      }
    }

    console.log("Created status update history");
    console.log("Database seeding completed successfully!");
    console.log("\nSummary:");
    console.log("- 4 Projects");
    console.log("- 3 Recurring Meeting Series (with occurrences)");
    console.log("- 7 Regular One-off Meetings");
    console.log("- Points distributed across series and meetings");
    console.log("- Status updates for point history");

  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}

// To run the full seed, use: npx tsx server/seed.ts
// The seed function is also exported for programmatic use
export { seed };
