"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Clock3, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { NebulaMark } from "@/components/kit/logo";

const CONTACT_EMAIL = "contact@nebulaknowlab.com";

/** Contact details from the supplied brand reference; unknown destinations stay disabled. */
export function SiteFooter() {
  const [email, setEmail] = React.useState("");
  const [notice, setNotice] = React.useState("");

  function requestNewsletter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const subject = encodeURIComponent("The Nebula Dispatch — subscription request");
    const body = encodeURIComponent(`Please subscribe ${email} to The Nebula Dispatch.`);
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    setNotice("Finish sending the request in your email app to ask to subscribe.");
  }

  return (
    <footer className="site-contact-footer">
      <div className="site-contact-footer-inner">
        <div className="site-contact-footer-columns">
          <div className="site-contact-footer-brand">
            <Link href="/" aria-label="Nebula KnowLab home" className="site-contact-footer-logo"><NebulaMark size={44} /><span>Nebula KnowLab<sup>®</sup></span></Link>
            <p className="site-contact-footer-description">Future-skills education for what’s next — turning rapidly evolving technology into structured, hands-on learning you can actually use.</p>
            <form onSubmit={requestNewsletter} className="site-contact-footer-newsletter">
              <label htmlFor="dispatch-email">The Nebula Dispatch</label>
              <div className="site-contact-footer-email">
                <input id="dispatch-email" name="email" type="email" autoComplete="email" placeholder="you@email.com" required value={email} onChange={(event) => setEmail(event.target.value)} aria-describedby="dispatch-help" />
                <button type="submit" aria-label="Request newsletter subscription by email"><ArrowRight size={18} aria-hidden /></button>
              </div>
              <p id="dispatch-help">Occasional, chosen emails. No noise. Unsubscribe anytime. Opens a request in your email app.</p>
              <p role="status" className="site-contact-footer-notice">{notice}</p>
            </form>
          </div>
          <nav aria-label="Explore" className="site-contact-footer-nav">
            <h2>Explore</h2>
            <ul>
              <li><Link href="/learn/courses">Courses</Link></li>
              <li><Link href="/learn/welcome">Find Your Track</Link></li>
              <li><span aria-disabled="true" title="Events link coming soon">Events</span></li>
              <li><span aria-disabled="true" title="Journal link coming soon">Journal</span></li>
            </ul>
          </nav>
          <nav aria-label="Company" className="site-contact-footer-nav">
            <h2>Company</h2>
            <ul>
              <li><Link href="/#faq">About</Link></li>
              <li><a href={`mailto:${CONTACT_EMAIL}`}>Contact</a></li>
              <li><span aria-disabled="true" title="Privacy policy link coming soon">Privacy</span></li>
              <li><span aria-disabled="true" title="Terms link coming soon">Terms</span></li>
            </ul>
          </nav>
        </div>
        <address className="site-contact-footer-contact">
          <a href={`mailto:${CONTACT_EMAIL}`}><Mail aria-hidden /><span>{CONTACT_EMAIL}</span></a>
          <a href="tel:+918220995005"><Phone aria-hidden /><span>+91 822 099 5005</span></a>
          <div><Clock3 aria-hidden /><span>8 AM – 8 PM, all days</span></div>
          <a href="https://www.google.com/maps/search/?api=1&query=Lakshmi+Mills+Junction+686+Avinashi+Road+Coimbatore+641037" target="_blank" rel="noopener noreferrer"><MapPin aria-hidden /><span>Lakshmi Mills Junction, 3rd Floor, No. 686, Avinashi Road, Coimbatore 641 037</span></a>
        </address>
        <div className="site-contact-footer-bottom">
          <p>© {new Date().getFullYear()} Nebula KnowLab. Shaping tomorrow’s talent, today.</p>
          <div className="site-contact-footer-social" aria-label="Social profiles coming soon">
            {["LinkedIn", "Instagram", "Facebook", "X", "YouTube"].map((label) => <span key={label} aria-disabled="true" title={`${label} link coming soon`}>{label}</span>)}
          </div>
        </div>
      </div>
      <a className="site-contact-footer-whatsapp" href="https://wa.me/918220995005" target="_blank" rel="noopener noreferrer" aria-label="Contact Nebula KnowLab on WhatsApp"><MessageCircle size={27} aria-hidden /></a>
    </footer>
  );
}
