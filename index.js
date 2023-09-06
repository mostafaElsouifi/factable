require("dotenv").config();
const puppeteer = require("puppeteer");
const { MAIN_URL } = process.env;
const {
  delay,
  elementExists,
  writeToJson,
  writeToCsv,
} = require("./helpers.js");

const getAllPostsUrls = async (page, mainUrl) => {
  try {
    await page.goto(mainUrl);

    // check if there is more button

    let moreButton = await elementExists(page, "#load-more");

    while (moreButton) {
      await page.click("#load-more");
      await delay(1);
      moreButton = await elementExists(page, "#load-more");
    }

    // get all posts urls - image - title
    const allPosts = await page.evaluate(() => {
      const posts = [];
      const postsContainers = document.querySelectorAll('div[role="article"]');
      for (let i = 0; i < postsContainers.length; i++) {
        posts.push({
          postUrl: postsContainers[i].querySelector("a").href,
          mainImage: postsContainers[i].querySelector("img").src,
          title: postsContainers[i].querySelector(".title").textContent.trim(),
        });
      }

      return posts;
    });

    return allPosts;
  } catch (e) {
    console.log(e);
  }
};
const getPostData = async (page, postUrl) => {
  await page.goto(postUrl);
  const data = await page.evaluate(() => {
    const allHeadings = [];

    let intro = document.querySelector(".inner-entry-content p").textContent;
    let introContainer = document.querySelector(".inner-entry-content p");

    if (introContainer && introContainer.nextElementSibling) {
      while (introContainer.nextElementSibling.tagName.toLowerCase() === "p") {
        intro += "\n" + introContainer.nextElementSibling.textContent.trim();
        introContainer = introContainer.nextElementSibling;
        if (!introContainer.nextElementSibling) break;
      }
    }

    const headings = document.querySelectorAll("h2");
    const allImages = document.querySelectorAll(".picture-container img");

    let contentContainer;
    // loop through all headings in the post
    for (let i = 0; i < headings.length; i++) {
      let content = "";
      if (i === 0) {
        contentContainer = document.querySelector(
          "#primary-under-image-P0-wrapper"
        );
        if (contentContainer && contentContainer.nextElementSibling) {
          while (
            contentContainer.nextElementSibling.tagName.toLowerCase() === "p"
          ) {
            content += contentContainer.nextElementSibling.textContent.trim();
            contentContainer = contentContainer.nextElementSibling;
            if (!contentContainer.nextElementSibling) break;
          }
        }
      }
      if (i > 0) {
        contentContainer = document.querySelectorAll(`#page-${i + 1} p`);
        for (let i = 0; i < contentContainer.length; i++) {
          content += contentContainer[i].textContent.trim() + "\n";
        }
      }
      //
      let image;
      if (allImages.length < headings.length) {
        if (i === 0) {
          image = "";
        } else {
          image = allImages[i - 1].src;
        }
      } else {
        image = allImages[i].src;
      }
      allHeadings.push({
        heading: headings[i].textContent,
        image: image,
        content: content,
      });
    }
    return {
      intro,
      allHeadings,
    };
  });
  return data;
};

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    ignoreDefaultArgs: [
      "--enable-automation",
      "--disable-extensions",
      "--disable-default-apps",
      "--disable-component-extensions-with-background-pages",
    ],
  });

  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(0);
  const allPosts = await getAllPostsUrls(page, MAIN_URL);

  // loop through each post url and collect all data
  for (let i = 0; i < allPosts.length; i++) {
    const postData = await getPostData(page, allPosts[i].postUrl);

    allPosts[i].intro = postData.intro;
    allPosts[i].headings = postData.allHeadings;
  }
  await browser.close();
  writeToJson(allPosts, "allposts.json");
  //   writeToCsv(allPosts, "allPosts.xlsx");
})();
