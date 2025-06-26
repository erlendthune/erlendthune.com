import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: 'Treasure Hunter',
    url: '/docs/treasurehunter/instructions',
    img: "img/treasurehunter.png",
    description: (
      <>
        Treasure Hunter is an app that allows you to create treasure hunts for
         your friends and family.
      </>
    ),
  },
  {
    title: 'Polpriser',
    url: '/docs/polpriser/ompolpriser',
    img: "img/polpriser.webp",
    description: (
      <>
        Appen Polpriser har alle vinmonopolets varer og priser i en database p&aring; telefonen slik at du ikke trenger &aring; v&aelig;re p&aring; nett for &aring; bruke den.
      </>
    ),
  },
  {
    title: 'Garmin wizard',
    url: '/docs/garminwizard/aboutgarminwizard',
    img: "img/watchwizard.webp",
    description: (
      <>
        Garmin watches has several hundred features. This wizard helps you find the watch that has the features that are important to you.
      </>
    ),
   },
   {
      title: 'Corrate',
      url: '/docs/corrate/aboutcorrate',
      img: "img/corrate.webp",
      description: (
        <>
        The app Corrate uses synthetic speech to announce your heart rate as often as you like - provided you have a bluetooth smart heart rate sensor connected, 
        </>
      ),    
    },
    {
      title: 'Books',
      url: 'https://www.erlendthune.com/sverrethune',
      img: "img/sovellasmall.png",
      description: (
        <>
        My father Sverre Thune has written several books. This page lists them all. 
        </>
      ),    
    }
];

function Feature({img, title, description, url}) {
  return (
    <div className={clsx('col col--4')}>
      <a href={url}>
        <div className="text--center">
          <img src={img} width="100px" />
        </div>
        <div className="text--center padding-horiz--md">
          <Heading as="h3">{title}</Heading>
          <p>{description}</p>
        </div>
      </a>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
