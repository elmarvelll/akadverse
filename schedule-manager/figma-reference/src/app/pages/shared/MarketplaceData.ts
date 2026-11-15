export const SKILLS_LIST = [
  "Content Writing", "Graphic Design", "UI/UX Design", "Web Development", "Mobile App Development",
  "Video Editing", "Photography", "Music Production", "Digital Marketing", "SEO Optimization",
  "Social Media Management", "Data Analysis", "Machine Learning", "Python Programming", "JavaScript Development",
  "React Development", "Game Development", "Illustration", "Animation", "Voice Acting",
  "Translation", "Proofreading", "Resume Writing", "Business Consulting", "Tutoring",
  "Math Tutoring", "Physics Tutoring", "Chemistry Tutoring", "Coding Tutoring", "Logo Design",
  "Branding", "3D Modeling", "3D Animation", "Interior Design", "Event Photography",
  "Drone Videography", "Podcast Editing", "Audio Engineering", "Public Speaking Coaching", "Career Coaching",
  "Research Assistance", "Virtual Assistance", "Product Photography", "Fashion Design", "Tailoring",
  "Makeup Artistry", "Hair Styling", "Fitness Coaching", "Nutrition Advice", "Language Teaching", "Music Lessons"
];

export const PRODUCTS_LIST = [
  "Laptop", "Headphones", "Mechanical Keyboard", "Wireless Mouse", "Power Bank",
  "USB Hub", "Phone Case", "Tablet", "Monitor", "Gaming Chair",
  "Study Lamp", "Backpack", "Calculator", "Smart Watch", "Portable SSD",
  "Bluetooth Speaker", "Camera", "Tripod", "External Hard Drive", "Desk Organizer",
  "Whiteboard", "Notebook Set", "Stationery Kit", "Printer", "Graphics Tablet",
  "Drawing Pad", "Smart Pen", "Desk Fan", "Mini Fridge", "LED Strip Lights",
  "Coffee Maker", "Electric Kettle", "Microwave", "Hair Dryer", "Electric Clippers",
  "Skincare Set", "Makeup Kit", "Sneakers", "Hoodies", "Jackets",
  "Wrist Watches", "Perfume", "Sunglasses", "Bicycle", "Scooter",
  "Portable Charger", "VR Headset", "Game Controller", "Smart Ring", "Tablet Stand"
];

export const BUSINESSES_LIST = [
  "Campus Print Shop", "Student Bakery", "Tech Repair Hub", "Phone Accessories Store", "Campus Laundry",
  "Custom Clothing Brand", "Laptop Repair", "Photography Studio", "Campus Barbershop", "Hair Styling Studio",
  "Sneaker Cleaning Pro", "Campus Grocery Run", "Textbook Exchange", "Gadget Rentals", "Dorm Cleaning Co.",
  "Midnight Snacks Delivery", "Bicycle Repair Shop", "Event Decorators", "Custom PC Builds", "Nail Art Studio"
];

const FIRST_NAMES = ["Alex", "Sarah", "John", "Emma", "Michael", "Grace", "David", "Jessica", "Daniel", "Chloe", "James", "Lily"];
const LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez"];

const generateRandomName = () => `${FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]}`;
const generateRandomRating = () => (Math.random() * 1.5 + 3.5).toFixed(1); // 3.5 to 5.0
const generateRandomReviews = () => Math.floor(Math.random() * 500) + 10;

export const generateSkills = () => {
  return SKILLS_LIST.map((title, i) => ({
    id: `skill-${i}`,
    title,
    seller: generateRandomName(),
    price: Math.floor(Math.random() * 100) * 1000 + 5000, // 5k to 105k
    rating: generateRandomRating(),
    reviews: generateRandomReviews()
  }));
};

export const generateProducts = () => {
  return PRODUCTS_LIST.map((title, i) => ({
    id: `product-${i}`,
    title,
    seller: generateRandomName(),
    price: Math.floor(Math.random() * 500) * 1000 + 10000, // 10k to 510k
    rating: generateRandomRating(),
    reviews: generateRandomReviews(),
    imageSeed: title.replace(/ /g, '').toLowerCase()
  }));
};

export const generateBusinesses = () => {
  return BUSINESSES_LIST.map((title, i) => ({
    id: `business-${i}`,
    title,
    owner: generateRandomName(),
    rating: generateRandomRating(),
    reviews: generateRandomReviews(),
    location: ["Hall 1", "Hall 2", "Student Center", "Library", "Cafeteria"][Math.floor(Math.random() * 5)],
    imageSeed: title.replace(/ /g, '').toLowerCase()
  }));
};

export const mockSkills = generateSkills();
export const mockProducts = generateProducts();
export const mockBusinesses = generateBusinesses();
