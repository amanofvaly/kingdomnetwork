import React from 'react';

export const CourseraCardPage = () => {
  return (
    <div style={{ backgroundColor: "#f5f5f5", padding: "24px", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ backgroundColor: "#00255d", background: "linear-gradient(90deg, #00255d 0%, #0056d2 100%)", padding: "48px 64px", borderRadius: "8px", position: "relative", overflow: "hidden", color: "white", fontFamily: "Source Sans Pro, Arial, sans-serif", width: "100%", maxWidth: "1000px", margin: "0 auto", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
        {/* Decorative Circles */}
        <div style={{ position: "absolute", top: "-50%", right: "-10%", width: "400px", height: "400px", background: "radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 70%)", borderRadius: "50%", zIndex: 1 }} />
        <div style={{ position: "absolute", bottom: "-50%", right: "10%", width: "500px", height: "500px", background: "radial-gradient(circle, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 70%)", borderRadius: "50%", zIndex: 1 }} />
        
        {/* Content */}
        <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <img src="https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/NxPkwTU0sAEpcAUWZkfR1/f1abc250476ce6841a0faff27924487b/Coursera_Plus_White_Logo.png?auto=format%2Ccompress&dpr=1" height="24" alt="Coursera Plus" style={{ marginBottom: "24px", display: "block" }} />
          
          <h2 style={{ fontSize: "2.5rem", fontWeight: 700, margin: "0 0 32px 0", maxWidth: "600px", lineHeight: 1.2 }}>
            Grow more with a full year for ₹7,499
          </h2>
          
          <a href="https://www.coursera.org/courseraplus/special/cplus-annual-august-2026-india" style={{ display: "inline-block", backgroundColor: "white", color: "#0056d2", padding: "14px 28px", borderRadius: "4px", fontWeight: 600, fontSize: "1.125rem", textDecoration: "none" }}>
            Save on Coursera Plus
          </a>
        </div>
      </div>
    </div>
  );
};
