import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrandMarkComponent } from './brand-mark.component';

describe('BrandMarkComponent', () => {
  let component: BrandMarkComponent;
  let fixture: ComponentFixture<BrandMarkComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BrandMarkComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BrandMarkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the Ω logo image', () => {
    const img = fixture.nativeElement.querySelector('img.brand-mark__logo');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toContain('logo-512.png');
    // Decorative image — wordmark provides the accessible name.
    expect(img.getAttribute('alt')).toBe('');
  });

  it('renders the wordmark when showText is true (default)', () => {
    const text = fixture.nativeElement.querySelector('.brand-mark__text');
    expect(text).toBeTruthy();
    expect(text.textContent).toContain('Modders');
    expect(text.textContent).toContain('Omni');
  });

  it('hides the wordmark when showText is false', () => {
    fixture.componentRef.setInput('showText', false);
    fixture.detectChanges();
    const text = fixture.nativeElement.querySelector('.brand-mark__text');
    expect(text).toBeFalsy();
  });

  it('responds to size input', () => {
    fixture.componentRef.setInput('size', 'lg');
    fixture.detectChanges();
    const host = fixture.nativeElement;
    // size=lg → 48px icon per the size table
    expect(getComputedStyle(host).getPropertyValue('--brand-mark-icon-size').trim()).toBe('48px');
  });
});
