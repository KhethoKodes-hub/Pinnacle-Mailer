import { createHash, randomBytes } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import { LayoutType, PrismaClient, TemplateStatus } from '@prisma/client';

loadEnv({ path: 'apps/backend/prisma/.env' });

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

function generatedClientSecret(): string {
  return `pm_${randomBytes(18).toString('base64url')}`;
}

function getEnvWithDefault(key: string, fallback: string): string {
  const value = process.env[key]?.trim();
  return value && value.length > 0 ? value : fallback;
}

type SeededUser = {
  email: string;
  displayName: string;
  password: string;
};

async function main() {
  const authBaseUrl = getEnvWithDefault('AUTH_URL', 'http://localhost:4200').replace(/\/$/, '');
  const supportEmail = getEnvWithDefault('SUPPORT_EMAIL', 'esthers@pinnaclerewards.co.za');
  const brandUrl = getEnvWithDefault('BRAND_URL', 'https://pinnaclerewards.co.za');
  const footerYear = new Date().getFullYear();
  const templateSurfaceColor = '#F5F5F5';
  const templateTextColor = '#1F2937';
  const templateAccentBlue = '#00325A';
  const standardHeroImageUrl = getEnvWithDefault(
    'SEED_TEMPLATE_HERO_IMAGE_URL',
    'https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=1200&q=80',
  );

  function buildStandardBodyMjml(bodyTitle: string, bodyLine: string): string {
    return `<mj-section background-color="${templateSurfaceColor}" padding="0 24px"><mj-column><mj-image src="${standardHeroImageUrl}" alt="Template hero image" width="348px" align="left" /></mj-column></mj-section><mj-section background-color="${templateSurfaceColor}" padding="24px 24px 8px"><mj-column><mj-text color="#6B7280" font-size="11px" font-style="italic" font-weight="500" padding-bottom="4px">Email body starts here</mj-text><mj-text color="${templateTextColor}" font-size="24px" font-weight="700" text-transform="uppercase" letter-spacing="0.6px" padding-bottom="2px">HELLO <span style="font-size:12px;font-weight:500;text-transform:none;">FIRST NAME TAG</span></mj-text><mj-text color="${templateTextColor}" font-size="24px" font-weight="800" text-transform="uppercase" padding-top="10px">${bodyTitle}</mj-text><mj-text color="#475467" font-size="14px" line-height="20px" padding-top="8px">${bodyLine}</mj-text></mj-column></mj-section>`;
  }

  const defaultHeaderLayoutModel = {
    accentColor: '#640098',
    backgroundColor: templateSurfaceColor,
    textColor: templateTextColor,
    blocks: [
      {
        id: 'seed_header_brand',
        type: 'brand',
        text: 'Email header starts here',
        logoUrl: `${authBaseUrl}/pinnacle-logo.png`,
      },
      {
        id: 'seed_header_nav',
        type: 'nav_links',
        links: [
          {
            id: 'seed_header_nav_1',
            label: 'TEST LINK',
            href: brandUrl,
          },
        ],
      },
    ],
  };
  const defaultHeaderMjml = '<mj-section background-color="'
    + `${templateSurfaceColor}`
    + '" padding="16px 24px 6px"><mj-column><mj-text color="#374151" font-size="14px" font-weight="700">Email header starts here</mj-text></mj-column></mj-section>'
    + '<mj-section background-color="'
    + `${templateSurfaceColor}`
    + '" padding="0 24px 12px"><mj-group><mj-column width="65%"><mj-image align="left" width="220px" src="'
    + `${authBaseUrl}/pinnacle-logo.png`
    + '" alt="Pinnacle Rewards" /></mj-column><mj-column width="35%"><mj-text align="right" font-size="14px" font-weight="800" color="'
    + `${templateTextColor}`
    + '" padding-top="14px"><a href="'
    + `${brandUrl}`
    + '" style="color:'
    + `${templateTextColor}`
    + ';text-decoration:none;">TEST LINK</a></mj-text></mj-column></mj-group></mj-section>';
  const defaultFooterLayoutModel = {
    accentColor: templateAccentBlue,
    backgroundColor: templateSurfaceColor,
    textColor: templateTextColor,
    blocks: [
      {
        id: 'seed_footer_divider',
        type: 'divider',
      },
      {
        id: 'seed_footer_legal',
        type: 'legal',
        text: `Footer starts here... Got questions? Just reach out to ${supportEmail}`,
      },
      {
        id: 'seed_footer_links',
        type: 'social',
        links: [
          {
            id: 'seed_footer_link_1',
            label: 'TEST LINK 2',
            href: brandUrl,
          },
        ],
      },
      {
        id: 'seed_footer_brand',
        type: 'legal',
        text: 'Footer Details\nPinnacle Rewards',
      },
    ],
  };
  const defaultFooterMjml = '<mj-section background-color="'
    + `${templateSurfaceColor}`
    + '" padding="0 24px"><mj-column><mj-divider border-color="#EAECF0" /></mj-column></mj-section>'
    + '<mj-section background-color="'
    + `${templateSurfaceColor}`
    + '" padding="6px 24px 0"><mj-column><mj-text color="'
    + `${templateTextColor}`
    + '" font-size="14px" font-weight="700">Footer starts here...</mj-text><mj-text color="'
    + `${templateTextColor}`
    + '" font-size="14px" line-height="20px">Got questions? Just reach out to <a href="mailto:'
    + `${supportEmail}`
    + '" style="color:'
    + `${templateTextColor}`
    + ';text-decoration:underline;">'
    + `${supportEmail}`
    + '</a></mj-text><mj-button href="'
    + `${brandUrl}`
    + '" background-color="'
    + `${templateAccentBlue}`
    + '" color="#FFFFFF" border-radius="999px" font-size="13px" font-weight="600" text-transform="uppercase" inner-padding="12px 28px" align="center">TEST LINK 2</mj-button><mj-text color="'
    + `${templateTextColor}`
    + '" font-size="14px" font-weight="500" padding-top="10px">Footer Details</mj-text><mj-text color="'
    + `${templateTextColor}`
    + '" font-size="30px" font-weight="700" padding-top="0">Pinnacle Rewards</mj-text></mj-column></mj-section>'
    + '<mj-section background-color="'
    + `${templateSurfaceColor}`
    + '" padding="0 24px 20px"><mj-group><mj-column width="60%"><mj-image align="left" width="105px" src="'
    + `${authBaseUrl}/pinnacle-logo.png`
    + '" alt="Pinnacle Rewards" /></mj-column><mj-column width="40%"><mj-text align="right" color="#475467" font-size="18px" padding-top="56px">&copy; '
    + `${footerYear}`
    + ' Test Email</mj-text></mj-column></mj-group></mj-section>';

  const seededUsers: SeededUser[] = [
    {
      email: getEnvWithDefault('ADMIN_EMAIL', 'admin@pinnacle.local'),
      displayName: getEnvWithDefault('ADMIN_DISPLAY_NAME', 'Pinnacle Admin'),
      password: getEnvWithDefault('ADMIN_PASSWORD', 'admin1234'),
    },
    {
      email: getEnvWithDefault('DEMO_ADMIN_EMAIL', 'demo@byom.de'),
      displayName: getEnvWithDefault('DEMO_ADMIN_DISPLAY_NAME', 'BYOM Demo Admin'),
      password: getEnvWithDefault('DEMO_ADMIN_PASSWORD', 'demo1234'),
    },
  ];

  const usersByEmail = new Map<string, SeededUser>();
  for (const user of seededUsers) {
    usersByEmail.set(user.email.toLowerCase(), user);
  }

  const seededClients = [
    {
      name: 'Pinnacle Admin BFF',
      clientId: 'pinnacle-admin-bff',
      scopes: ['admin', 'templates:read', 'templates:write', 'media:read', 'media:write', 'layouts:read', 'layouts:write', 'audit:read'],
    },
    {
      name: 'Partner Readonly Integration',
      clientId: 'partner-readonly',
      scopes: ['templates:read', 'media:read', 'layouts:read'],
    },
  ].map((client) => ({
    ...client,
    clientSecret: generatedClientSecret(),
  }));

  let admin: { id: string } | null = null;

  for (const user of usersByEmail.values()) {
    const created = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        displayName: user.displayName,
        passwordHash: hashPassword(user.password),
      },
      create: {
        email: user.email,
        displayName: user.displayName,
        passwordHash: hashPassword(user.password),
      },
    });

    if (user.email.toLowerCase() === getEnvWithDefault('ADMIN_EMAIL', 'admin@pinnacle.local').toLowerCase()) {
      admin = created;
    }
  }

  if (!admin) {
    throw new Error('Unable to resolve seeded admin user for ownership fields.');
  }

  const header = await prisma.emailLayout.upsert({
    where: { id: 'header-default' },
    update: {
      name: 'Default Header',
      type: LayoutType.header,
      mjml: defaultHeaderMjml,
      layoutJson: JSON.stringify(defaultHeaderLayoutModel),
      lastUpdatedById: admin.id,
    },
    create: {
      id: 'header-default',
      name: 'Default Header',
      type: LayoutType.header,
      mjml: defaultHeaderMjml,
      layoutJson: JSON.stringify(defaultHeaderLayoutModel),
      lastUpdatedById: admin.id,
    },
  });

  const footer = await prisma.emailLayout.upsert({
    where: { id: 'footer-default' },
    update: {
      name: 'Default Footer',
      type: LayoutType.footer,
      mjml: defaultFooterMjml,
      layoutJson: JSON.stringify(defaultFooterLayoutModel),
      lastUpdatedById: admin.id,
    },
    create: {
      id: 'footer-default',
      name: 'Default Footer',
      type: LayoutType.footer,
      mjml: defaultFooterMjml,
      layoutJson: JSON.stringify(defaultFooterLayoutModel),
      lastUpdatedById: admin.id,
    },
  });

  const templates = [
    {
      id: 'template-order-confirmation',
      name: 'Test Template',
      slug: 'order-confirmation',
      subject: 'Test template',
      bodyMjml: buildStandardBodyMjml('EMAIL BODY', 'Body copy for seed standard template.'),
    },
    {
      id: 'template-password-reset',
      name: 'Password Reset',
      slug: 'password-reset',
      subject: 'Reset your password',
      bodyMjml: buildStandardBodyMjml('PASSWORD RESET', 'Use your secure link to complete your reset request.'),
    },
    {
      id: 'template-seasonal-campaign',
      name: 'Seasonal Campaign',
      slug: 'seasonal-campaign',
      subject: 'Seasonal Rewards Promo',
      bodyMjml: buildStandardBodyMjml('SEASONAL REWARDS', 'Earn 2x points this week only.'),
    },
  ];

  for (const item of templates) {
    const template = await prisma.emailTemplate.upsert({
      where: { slug: item.slug },
      update: {
        name: item.name,
        subject: item.subject,
        bodyMjml: item.bodyMjml,
        blocksJson: '[]',
        headerLayoutId: header.id,
        footerLayoutId: footer.id,
        status: TemplateStatus.published,
        lastUpdatedById: admin.id,
      },
      create: {
        id: item.id,
        name: item.name,
        slug: item.slug,
        subject: item.subject,
        bodyMjml: item.bodyMjml,
        blocksJson: '[]',
        headerLayoutId: header.id,
        footerLayoutId: footer.id,
        status: TemplateStatus.published,
        lastUpdatedById: admin.id,
      },
    });

    await prisma.templateVersion.upsert({
      where: {
        templateId_version: {
          templateId: template.id,
          version: 1,
        },
      },
      update: {
        subject: item.subject,
        bodyMjml: item.bodyMjml,
        blocksJson: '[]',
      },
      create: {
        templateId: template.id,
        version: 1,
        subject: item.subject,
        bodyMjml: item.bodyMjml,
        blocksJson: '[]',
        createdById: admin.id,
      },
    });
  }

  for (const client of seededClients) {
    await prisma.apiClient.upsert({
      where: { clientId: client.clientId },
      update: {
        name: client.name,
        clientSecretHash: hashPassword(client.clientSecret),
        scopesJson: JSON.stringify(client.scopes),
        isActive: true,
        revokedAt: null,
      },
      create: {
        name: client.name,
        clientId: client.clientId,
        clientSecretHash: hashPassword(client.clientSecret),
        scopesJson: JSON.stringify(client.scopes),
        isActive: true,
      },
    });
  }

  console.log('Seed complete');
  console.log('Seeded users (passwords shown once):');
  for (const user of usersByEmail.values()) {
    console.log(`- ${user.email} / ${user.password}`);
  }

  console.log('Seeded API clients:');
  for (const client of seededClients) {
    console.log(`- ${client.clientId} / ${client.clientSecret}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });