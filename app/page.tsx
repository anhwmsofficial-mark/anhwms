'use client';

import HomeNavbar from '@/components/home/HomeNavbar';
import HeroSection from '@/components/home/HeroSection';
import AboutSection from '@/components/home/AboutSection';
import ServicesSection from '@/components/home/ServicesSection';
import CompaniesSection from '@/components/home/CompaniesSection';
import ClientsSection from '@/components/home/ClientsSection';
import ProcessSection from '@/components/home/ProcessSection';
import NewsSection from '@/components/home/NewsSection';
import ContactSection from '@/components/home/ContactSection';
import Footer from '@/components/home/Footer';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <HomeNavbar />
      <HeroSection />
      <AboutSection />
      <ServicesSection />
      <CompaniesSection />
      <ClientsSection />
      <ProcessSection />
      <NewsSection />
      <ContactSection />
      <Footer />
    </div>
  );
}
